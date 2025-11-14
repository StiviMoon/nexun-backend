import { Server as SocketIOServer } from "socket.io";
import { AuthenticatedSocket } from "../middleware/socketAuthMiddleware";
import { ChatService } from "../services/chatService";
import {
  ChatMessage,
  JoinRoomData,
  SendMessageData,
  CreateRoomData
} from "../types/chat";

export class ChatController {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Handle new socket connection
   */
  handleConnection = (socket: AuthenticatedSocket): void => {
    if (!socket.user) {
      socket.disconnect();
      return;
    }

    const userId = socket.user.uid;

    // Track connected user
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)?.add(socket.id);

    console.log(`✅ User ${userId} connected (socket: ${socket.id})`);

    // Emit connection status to user's other devices
    socket.broadcast.emit("user:online", { userId });

    // Send user's rooms on connection
    this.sendUserRooms(socket);

    // Register event handlers
    this.registerEventHandlers(socket);

    // Handle disconnection
    socket.on("disconnect", () => {
      this.handleDisconnection(socket);
    });
  };

  /**
   * Register all event handlers for a socket
   */
  private registerEventHandlers = (socket: AuthenticatedSocket): void => {
    socket.on("room:join", (data: JoinRoomData) => {
      this.handleJoinRoom(socket, data);
    });

    socket.on("room:leave", (data: JoinRoomData) => {
      this.handleLeaveRoom(socket, data);
    });

    socket.on("message:send", (data: SendMessageData) => {
      this.handleSendMessage(socket, data);
    });

    socket.on("room:create", (data: CreateRoomData) => {
      this.handleCreateRoom(socket, data);
    });

    socket.on("room:get", (roomId: string) => {
      this.handleGetRoom(socket, roomId);
    });

    socket.on("messages:get", (data: { roomId: string; limit?: number; lastMessageId?: string }) => {
      this.handleGetMessages(socket, data);
    });
  };

  /**
   * Handle user disconnection
   */
  private handleDisconnection = (socket: AuthenticatedSocket): void => {
    if (!socket.user) {
      return;
    }

    const userId = socket.user.uid;
    const userSockets = this.connectedUsers.get(userId);

    if (userSockets) {
      userSockets.delete(socket.id);

      // If user has no more active connections, mark as offline
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
        socket.broadcast.emit("user:offline", { userId });
        console.log(`❌ User ${userId} disconnected (all sessions)`);
      } else {
        console.log(`🔌 User ${userId} disconnected (socket: ${socket.id}, ${userSockets.size} sessions remaining)`);
      }
    }
  };

  /**
   * Handle joining a room
   */
  private handleJoinRoom = async (
    socket: AuthenticatedSocket,
    data: JoinRoomData
  ): Promise<void> => {
    if (!socket.user) {
      socket.emit("error", { message: "Unauthorized" });
      return;
    }

    try {
      const { roomId } = data;

      // Verify room exists
      const room = await ChatService.getRoom(roomId);
      if (!room) {
        socket.emit("error", { message: "Room not found", code: "ROOM_NOT_FOUND" });
        return;
      }

      // Check if user is a participant
      const isParticipant = await ChatService.isParticipant(roomId, socket.user.uid);

      // For public rooms (group/channel), allow joining and auto-add as participant
      if (!isParticipant) {
        if (room.type === "group" || room.type === "channel") {
          // Auto-add user as participant for public rooms
          await ChatService.addParticipant(roomId, socket.user.uid);
          console.log(`➕ Auto-added user ${socket.user.uid} as participant to public room ${roomId}`);
        } else {
          // For direct rooms, require explicit invitation
          socket.emit("error", {
            message: "You are not a participant of this room",
            code: "NOT_PARTICIPANT"
          });
          return;
        }
      }

      // Join the socket room
      await socket.join(roomId);

      // Notify others in the room
      socket.to(roomId).emit("room:user-joined", {
        roomId,
        userId: socket.user.uid,
        userName: socket.user.name
      });

      socket.emit("room:joined", { roomId, room });

      console.log(`👤 User ${socket.user.uid} joined room ${roomId}`);
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to join room",
        code: "JOIN_ROOM_ERROR"
      });
    }
  };

  /**
   * Handle leaving a room
   */
  private handleLeaveRoom = async (
    socket: AuthenticatedSocket,
    data: JoinRoomData
  ): Promise<void> => {
    if (!socket.user) {
      return;
    }

    try {
      const { roomId } = data;

      await socket.leave(roomId);

      // Notify others in the room
      socket.to(roomId).emit("room:user-left", {
        roomId,
        userId: socket.user.uid,
        userName: socket.user.name
      });

      socket.emit("room:left", { roomId });

      console.log(`👋 User ${socket.user.uid} left room ${roomId}`);
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to leave room",
        code: "LEAVE_ROOM_ERROR"
      });
    }
  };

  /**
   * Handle sending a message
   */
  private handleSendMessage = async (
    socket: AuthenticatedSocket,
    data: SendMessageData
  ): Promise<void> => {
    if (!socket.user) {
      socket.emit("error", { message: "Unauthorized" });
      return;
    }

    try {
      const { roomId, content, type = "text", metadata } = data;

      // Verify room exists and user is a participant
      const room = await ChatService.getRoom(roomId);
      if (!room) {
        socket.emit("error", { message: "Room not found", code: "ROOM_NOT_FOUND" });
        return;
      }

      const isParticipant = await ChatService.isParticipant(roomId, socket.user.uid);
      if (!isParticipant) {
        socket.emit("error", {
          message: "You are not a participant of this room",
          code: "NOT_PARTICIPANT"
        });
        return;
      }

      // Get user profile for message
      const userProfile = await ChatService.getUserProfile(socket.user.uid);

      // Create message
      const message: ChatMessage = {
        id: "", // Will be set by saveMessage
        roomId,
        senderId: socket.user.uid,
        senderName: userProfile?.name || socket.user.name,
        senderPicture: userProfile?.picture || socket.user.picture,
        content,
        timestamp: new Date(),
        type,
        metadata
      };

      // Save message to database
      const savedMessage = await ChatService.saveMessage(message);

      // Emit message to all clients in the room
      this.io.to(roomId).emit("message:new", savedMessage);

      console.log(`💬 Message sent in room ${roomId} by ${socket.user.uid}`);
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to send message",
        code: "SEND_MESSAGE_ERROR"
      });
    }
  };

  /**
   * Handle creating a room
   */
  private handleCreateRoom = async (
    socket: AuthenticatedSocket,
    data: CreateRoomData
  ): Promise<void> => {
    if (!socket.user) {
      socket.emit("error", { message: "Unauthorized" });
      return;
    }

    try {
      const room = await ChatService.createRoom(data, socket.user.uid);

      // Join the creator to the room
      await socket.join(room.id);

      socket.emit("room:created", room);

      console.log(`🏠 Room ${room.id} created by ${socket.user.uid}`);
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to create room",
        code: "CREATE_ROOM_ERROR"
      });
    }
  };

  /**
   * Handle getting room details
   */
  private handleGetRoom = async (
    socket: AuthenticatedSocket,
    roomId: string
  ): Promise<void> => {
    if (!socket.user) {
      socket.emit("error", { message: "Unauthorized" });
      return;
    }

    try {
      const room = await ChatService.getRoom(roomId);

      if (!room) {
        socket.emit("error", { message: "Room not found", code: "ROOM_NOT_FOUND" });
        return;
      }

      const isParticipant = await ChatService.isParticipant(roomId, socket.user.uid);
      if (!isParticipant) {
        socket.emit("error", {
          message: "You are not a participant of this room",
          code: "NOT_PARTICIPANT"
        });
        return;
      }

      socket.emit("room:details", room);
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to get room",
        code: "GET_ROOM_ERROR"
      });
    }
  };

  /**
   * Handle getting messages
   */
  private handleGetMessages = async (
    socket: AuthenticatedSocket,
    data: { roomId: string; limit?: number; lastMessageId?: string }
  ): Promise<void> => {
    if (!socket.user) {
      socket.emit("error", { message: "Unauthorized" });
      return;
    }

    try {
      const { roomId, limit = 50, lastMessageId } = data;

      const isParticipant = await ChatService.isParticipant(roomId, socket.user.uid);
      if (!isParticipant) {
        socket.emit("error", {
          message: "You are not a participant of this room",
          code: "NOT_PARTICIPANT"
        });
        return;
      }

      const messages = await ChatService.getMessages(roomId, limit, lastMessageId);

      socket.emit("messages:list", { roomId, messages });
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to get messages",
        code: "GET_MESSAGES_ERROR"
      });
    }
  };

  /**
   * Send user's rooms on connection
   */
  private sendUserRooms = async (socket: AuthenticatedSocket): Promise<void> => {
    if (!socket.user) {
      return;
    }

    try {
      const rooms = await ChatService.getUserRooms(socket.user.uid);
      socket.emit("rooms:list", rooms);
    } catch (error) {
      console.error("Failed to send user rooms:", error);
    }
  };

  /**
   * Check if user is online
   */
  isUserOnline = (userId: string): boolean => {
    return this.connectedUsers.has(userId) && (this.connectedUsers.get(userId)?.size || 0) > 0;
  };

  /**
   * Get online users count
   */
  getOnlineUsersCount = (): number => {
    return this.connectedUsers.size;
  };
}


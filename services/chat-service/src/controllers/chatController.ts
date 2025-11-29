import { Server as SocketIOServer } from "socket.io";
import { AuthenticatedSocket } from "../../../../shared/middleware/socketAuthMiddleware";
import { ChatService } from "../services/chatService";
import {
  ChatMessage,
  JoinRoomData,
  SendMessageData,
  CreateRoomData,
  JoinByCodeData
} from "../../../../shared/types/chat";
import { Logger } from "../../../../shared/utils/logger";

export class ChatController {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private logger: Logger;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.logger = new Logger("chat-service");
  }

  /**
   * Handles new Socket.IO connection
   * @param socket - Authenticated socket connection
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

    this.logger.info(`User ${userId} connected (socket: ${socket.id})`);

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
   * Registers all Socket.IO event handlers for a socket
   * @param socket - Authenticated socket to register handlers for
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

    socket.on("room:join-by-code", (data: JoinByCodeData) => {
      this.handleJoinByCode(socket, data);
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
        this.logger.info(`User ${userId} disconnected (all sessions)`);
      } else {
        this.logger.info(`User ${userId} disconnected (socket: ${socket.id}, ${userSockets.size} sessions remaining)`);
      }
    }
  };

  /**
   * Handles joining a chat room
   * @param socket - Authenticated socket
   * @param data - Room join data containing roomId and optional code
   */
  private handleJoinRoom = async (
    socket: AuthenticatedSocket,
    data: JoinRoomData
  ): Promise<void> => {
    if (!socket.user) {
      socket.emit("error", { message: "Unauthorized", code: "UNAUTHORIZED" });
      return;
    }

    try {
      const { roomId, code } = data;

      // Verify room exists
      const room = await ChatService.getRoom(roomId);
      if (!room) {
        socket.emit("error", { message: "Room not found", code: "ROOM_NOT_FOUND" });
        return;
      }

      // Check if user is a participant FIRST (before code verification)
      const isParticipant = await ChatService.isParticipant(roomId, socket.user.uid);

      // Verify code for private rooms (only if user is not already a participant)
      if (room.visibility === "private" && !isParticipant) {
        if (!code) {
          socket.emit("error", {
            message: "Code required for private rooms",
            code: "CODE_REQUIRED"
          });
          return;
        }

        if (room.code !== code.toUpperCase()) {
          socket.emit("error", {
            message: "Invalid access code",
            code: "INVALID_CODE"
          });
          return;
        }
      }

      // Add user as participant if not already
      if (!isParticipant) {
        await ChatService.addParticipant(roomId, socket.user.uid);
        this.logger.info(`Added user ${socket.user.uid} as participant to room ${roomId}`);
      }

      // Join the socket room
      await socket.join(roomId);

      // Get updated room
      const updatedRoom = await ChatService.getRoom(roomId);

      // Notify others in the room
      socket.to(roomId).emit("room:user-joined", {
        roomId,
        userId: socket.user.uid,
        userName: socket.user.name
      });

      socket.emit("room:joined", { roomId, room: updatedRoom });

      this.logger.info(`User ${socket.user.uid} joined room ${roomId}`);
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

      this.logger.info(`User ${socket.user.uid} left room ${roomId}`);
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to leave room",
        code: "LEAVE_ROOM_ERROR"
      });
    }
  };

  /**
   * Handles sending a chat message
   * @param socket - Authenticated socket
   * @param data - Message data (roomId, content, type, metadata)
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

      this.logger.info(`Message sent in room ${roomId} by ${socket.user.uid}`);
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
      socket.emit("error", { message: "Unauthorized", code: "UNAUTHORIZED" });
      return;
    }

    try {
      // Validate required fields
      if (!data.name || !data.type || !data.visibility) {
        socket.emit("error", {
          message: "Name, type, and visibility are required",
          code: "VALIDATION_ERROR"
        });
        return;
      }

      const room = await ChatService.createRoom(data, socket.user.uid);

      // Join the creator to the room
      await socket.join(room.id);

      // Emit response with code included (if private)
      socket.emit("room:created", room);

      // Broadcast to others only if public
      if (room.visibility === "public") {
        socket.broadcast.emit("room:created", {
          ...room,
          code: undefined // Don't expose code to others
        });
      }

      this.logger.info(`Room ${room.id} created by ${socket.user.uid} (visibility: ${room.visibility})`);
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
      socket.emit("error", { message: "Unauthorized", code: "UNAUTHORIZED" });
      return;
    }

    try {
      const room = await ChatService.getRoom(roomId);

      if (!room) {
        socket.emit("error", { message: "Room not found", code: "ROOM_NOT_FOUND" });
        return;
      }

      const isParticipant = await ChatService.isParticipant(roomId, socket.user.uid);
      
      // For private rooms, require participation
      if (room.visibility === "private" && !isParticipant) {
        socket.emit("error", {
          message: "You are not a participant of this room",
          code: "NOT_PARTICIPANT"
        });
        return;
      }

      // For public rooms, allow viewing but hide code if not participant
      const roomToSend = {
        ...room,
        code: isParticipant ? room.code : undefined
      };

      socket.emit("room:details", roomToSend);
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to get room",
        code: "GET_ROOM_ERROR"
      });
    }
  };

  /**
   * Handle joining a room by code
   */
  private handleJoinByCode = async (
    socket: AuthenticatedSocket,
    data: JoinByCodeData
  ): Promise<void> => {
    if (!socket.user) {
      socket.emit("error", { message: "Unauthorized", code: "UNAUTHORIZED" });
      return;
    }

    try {
      const { code } = data;

      // Validate code format
      if (!code || code.trim().length < 6) {
        socket.emit("error", {
          message: "Invalid code format",
          code: "INVALID_CODE_FORMAT"
        });
        return;
      }

      // Search for room by code
      const room = await ChatService.getRoomByCode(code.toUpperCase());

      if (!room) {
        socket.emit("error", {
          message: "Room not found with this code",
          code: "ROOM_NOT_FOUND"
        });
        return;
      }

      // Verify it's a private room
      if (room.visibility !== "private") {
        socket.emit("error", {
          message: "This code does not correspond to a private room",
          code: "NOT_PRIVATE_ROOM"
        });
        return;
      }

      // Add user as participant if not already
      const isParticipant = await ChatService.isParticipant(room.id, socket.user.uid);
      if (!isParticipant) {
        await ChatService.addParticipant(room.id, socket.user.uid);
        this.logger.info(`Added user ${socket.user.uid} as participant to private room ${room.id}`);
      }

      // Join the socket room
      await socket.join(room.id);

      // Get updated room
      const updatedRoom = await ChatService.getRoom(room.id);

      // Notify others in the room
      socket.to(room.id).emit("room:user-joined", {
        roomId: room.id,
        userId: socket.user.uid,
        userName: socket.user.name
      });

      socket.emit("room:joined", {
        roomId: room.id,
        room: updatedRoom
      });

      this.logger.info(`User ${socket.user.uid} joined private room ${room.id} by code`);
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to join room by code",
        code: "JOIN_BY_CODE_ERROR"
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
      this.logger.error("Failed to send user rooms:", error);
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


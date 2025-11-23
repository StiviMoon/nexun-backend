import { Server as SocketIOServer } from "socket.io";
import { AuthenticatedSocket } from "../shared/middleware/socketAuthMiddleware";
import { VideoService } from "../services/videoService";
import {
  JoinVideoRoomData,
  CreateVideoRoomData,
  VideoSignalData
} from "../shared/types/video";
import { Logger } from "../shared/utils/logger";

export class VideoController {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Map<string, string>> = new Map(); // userId -> Map<roomId, socketId>
  private logger: Logger;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.logger = new Logger("video-service");
  }

  /**
   * Handles new Socket.IO connection for video service
   * @param socket - Authenticated socket connection
   */
  handleConnection = (socket: AuthenticatedSocket): void => {
    if (!socket.user) {
      socket.disconnect();
      return;
    }

    const userId = socket.user.uid;
    this.logger.info(`User ${userId} connected to video service (socket: ${socket.id})`);

    // Register event handlers
    this.registerEventHandlers(socket);

    // Handle disconnection
    socket.on("disconnect", () => {
      this.handleDisconnection(socket);
    });
  };

  /**
   * Registers all Socket.IO event handlers for video service
   * @param socket - Authenticated socket to register handlers for
   */
  private registerEventHandlers = (socket: AuthenticatedSocket): void => {
    socket.on("video:room:create", (data: CreateVideoRoomData) => {
      this.handleCreateRoom(socket, data);
    });

    socket.on("video:room:join", (data: JoinVideoRoomData) => {
      this.handleJoinRoom(socket, data);
    });

    socket.on("video:room:leave", (data: JoinVideoRoomData) => {
      this.handleLeaveRoom(socket, data);
    });

    socket.on("video:signal", (data: VideoSignalData) => {
      this.handleSignal(socket, data);
    });

    socket.on("video:toggle-audio", (data: { roomId: string; enabled: boolean }) => {
      this.handleToggleAudio(socket, data);
    });

    socket.on("video:toggle-video", (data: { roomId: string; enabled: boolean }) => {
      this.handleToggleVideo(socket, data);
    });

    socket.on("video:toggle-screen", (data: { roomId: string; enabled: boolean }) => {
      this.handleToggleScreen(socket, data);
    });

    socket.on("video:room:end", (data: { roomId: string }) => {
      this.handleEndRoom(socket, data);
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
    const userRooms = this.connectedUsers.get(userId);

    if (userRooms) {
      // Leave all rooms user was in
      for (const [roomId] of userRooms) {
        this.leaveRoom(userId, roomId);
      }
      this.connectedUsers.delete(userId);
    }

    this.logger.info(`User ${userId} disconnected from video service`);
  };

  /**
   * Handles creating a new video room
   * @param socket - Authenticated socket
   * @param data - Room creation data
   */
  private handleCreateRoom = async (
    socket: AuthenticatedSocket,
    data: CreateVideoRoomData
  ): Promise<void> => {
    if (!socket.user) {
      socket.emit("error", { message: "Unauthorized" });
      return;
    }

    try {
      const room = await VideoService.createRoom(data, socket.user.uid);

      // Track user in room
      if (!this.connectedUsers.has(socket.user.uid)) {
        this.connectedUsers.set(socket.user.uid, new Map());
      }
      this.connectedUsers.get(socket.user.uid)?.set(room.id, socket.id);

      // Join socket room
      await socket.join(room.id);

      // Add participant
      await VideoService.addParticipant(room.id, socket.user.uid, socket.id);

      socket.emit("video:room:created", room);
      this.logger.info(`Video room ${room.id} created by ${socket.user.uid}`);
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to create room",
        code: "CREATE_ROOM_ERROR"
      });
    }
  };

  /**
   * Handles joining a video room
   * @param socket - Authenticated socket
   * @param data - Room join data containing roomId
   */
  private handleJoinRoom = async (
    socket: AuthenticatedSocket,
    data: JoinVideoRoomData
  ): Promise<void> => {
    if (!socket.user) {
      socket.emit("error", { message: "Unauthorized" });
      return;
    }

    try {
      const { roomId } = data;

      // Verify room exists
      const room = await VideoService.getRoom(roomId);
      if (!room) {
        socket.emit("error", { message: "Room not found", code: "ROOM_NOT_FOUND" });
        return;
      }

      // Check if room is full
      if (room.participants.length >= (room.maxParticipants || 50)) {
        socket.emit("error", { message: "Room is full", code: "ROOM_FULL" });
        return;
      }

      // Track user in room
      if (!this.connectedUsers.has(socket.user.uid)) {
        this.connectedUsers.set(socket.user.uid, new Map());
      }
      this.connectedUsers.get(socket.user.uid)?.set(roomId, socket.id);

      // Join socket room
      await socket.join(roomId);

      // Add participant
      await VideoService.addParticipant(roomId, socket.user.uid, socket.id);

      // Get existing participants
      const participants = await VideoService.getRoomParticipants(roomId);

      // Notify others in the room
      socket.to(roomId).emit("video:user:joined", {
        roomId,
        userId: socket.user.uid,
        userName: socket.user.name
      });

      // Send room info and existing participants to the new user
      socket.emit("video:room:joined", {
        roomId,
        room,
        participants
      });

      this.logger.info(`User ${socket.user.uid} joined video room ${roomId}`);
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to join room",
        code: "JOIN_ROOM_ERROR"
      });
    }
  };

  /**
   * Handle leaving a video room
   */
  private handleLeaveRoom = async (
    socket: AuthenticatedSocket,
    data: JoinVideoRoomData
  ): Promise<void> => {
    if (!socket.user) {
      return;
    }

    try {
      const { roomId } = data;
      await this.leaveRoom(socket.user.uid, roomId);

      socket.emit("video:room:left", { roomId });
      this.logger.info(`User ${socket.user.uid} left video room ${roomId}`);
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to leave room",
        code: "LEAVE_ROOM_ERROR"
      });
    }
  };

  /**
   * Helper to leave a room
   * @param userId - User ID leaving the room
   * @param roomId - Room ID to leave
   */
  private async leaveRoom(userId: string, roomId: string): Promise<void> {
    await VideoService.removeParticipant(roomId, userId);

    // Remove from tracking
    const userRooms = this.connectedUsers.get(userId);
    if (userRooms) {
      userRooms.delete(roomId);
      if (userRooms.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }

    // Notify others in the room
    this.io.to(roomId).emit("video:user:left", {
      roomId,
      userId
    });
  }

  /**
   * Handle WebRTC signaling (offer, answer, ICE candidates)
   */
  private handleSignal = async (
    socket: AuthenticatedSocket,
    data: VideoSignalData
  ): Promise<void> => {
    if (!socket.user) {
      return;
    }

    try {
      const { type, roomId, targetUserId, data: signalData } = data;

      // Verify user is in the room
      const room = await VideoService.getRoom(roomId);
      if (!room || !room.participants.includes(socket.user!.uid)) {
        socket.emit("error", { message: "Not in room", code: "NOT_IN_ROOM" });
        return;
      }

      // Forward signal to target user or broadcast to all in room
      if (targetUserId) {
        // Send to specific user
        const participant = await VideoService.getParticipant(roomId, targetUserId);
        if (participant) {
          this.io.to(participant.socketId).emit("video:signal", {
            type,
            roomId,
            fromUserId: socket.user.uid,
            data: signalData
          });
        }
      } else {
        // Broadcast to all in room except sender
        socket.to(roomId).emit("video:signal", {
          type,
          roomId,
          fromUserId: socket.user.uid,
          data: signalData
        });
      }
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to send signal",
        code: "SIGNAL_ERROR"
      });
    }
  };

  /**
   * Handle toggling audio
   */
  private handleToggleAudio = async (
    socket: AuthenticatedSocket,
    data: { roomId: string; enabled: boolean }
  ): Promise<void> => {
    if (!socket.user) {
      return;
    }

    try {
      await VideoService.updateParticipantState(data.roomId, socket.user.uid, {
        isAudioEnabled: data.enabled
      });

      // Notify others in the room
      socket.to(data.roomId).emit("video:audio:toggled", {
        roomId: data.roomId,
        userId: socket.user.uid,
        enabled: data.enabled
      });
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to toggle audio",
        code: "TOGGLE_AUDIO_ERROR"
      });
    }
  };

  /**
   * Handle toggling video
   */
  private handleToggleVideo = async (
    socket: AuthenticatedSocket,
    data: { roomId: string; enabled: boolean }
  ): Promise<void> => {
    if (!socket.user) {
      return;
    }

    try {
      await VideoService.updateParticipantState(data.roomId, socket.user.uid, {
        isVideoEnabled: data.enabled
      });

      // Notify others in the room
      socket.to(data.roomId).emit("video:video:toggled", {
        roomId: data.roomId,
        userId: socket.user.uid,
        enabled: data.enabled
      });
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to toggle video",
        code: "TOGGLE_VIDEO_ERROR"
      });
    }
  };

  /**
   * Handle toggling screen sharing
   */
  private handleToggleScreen = async (
    socket: AuthenticatedSocket,
    data: { roomId: string; enabled: boolean }
  ): Promise<void> => {
    if (!socket.user) {
      return;
    }

    try {
      await VideoService.updateParticipantState(data.roomId, socket.user.uid, {
        isScreenSharing: data.enabled
      });

      // Notify others in the room
      socket.to(data.roomId).emit("video:screen:toggled", {
        roomId: data.roomId,
        userId: socket.user.uid,
        enabled: data.enabled
      });
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to toggle screen",
        code: "TOGGLE_SCREEN_ERROR"
      });
    }
  };

  /**
   * Handle ending a room (host only)
   */
  private handleEndRoom = async (
    socket: AuthenticatedSocket,
    data: { roomId: string }
  ): Promise<void> => {
    if (!socket.user) {
      socket.emit("error", { message: "Unauthorized" });
      return;
    }

    try {
      await VideoService.endRoom(data.roomId, socket.user.uid);

      // Notify all participants
      this.io.to(data.roomId).emit("video:room:ended", {
        roomId: data.roomId
      });

      // Disconnect all sockets from the room
      const sockets = await this.io.in(data.roomId).fetchSockets();
      sockets.forEach(s => s.leave(data.roomId));

      this.logger.info(`Video room ${data.roomId} ended by ${socket.user.uid}`);
    } catch (error) {
      socket.emit("error", {
        message: error instanceof Error ? error.message : "Failed to end room",
        code: "END_ROOM_ERROR"
      });
    }
  };

}


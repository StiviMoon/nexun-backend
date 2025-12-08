import { Server as SocketIOServer } from "socket.io";
import { AuthenticatedSocket } from "../shared/middleware/socketAuthMiddleware";
import { VideoService } from "../services/videoService";
import {
  JoinVideoRoomData,
  CreateVideoRoomData,
  VideoSignalData,
  VideoRoom
} from "../shared/types/video";
import { Logger } from "../shared/utils/logger";
import { isValidSignal } from "../shared/utils/webrtcConfig";
import { firestore } from "../shared/config/firebase";
import * as admin from "firebase-admin";

/**
 * VideoController - WebRTC signaling server for peer-to-peer video calls
 * Acts as a signaling server that forwards WebRTC signals (offers, answers, ICE candidates)
 * between clients. All video/audio streams flow directly peer-to-peer.
 */
interface SocketError {
  message: string;
  code?: string;
}

export class VideoController {
  private readonly io: SocketIOServer;
  private readonly connectedUsers: Map<string, Map<string, string>> = new Map();
  private readonly logger: Logger;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.logger = new Logger("video-service");
  }

  /**
   * Helper: Emit error to socket with consistent format
   */
  private emitError(socket: AuthenticatedSocket, message: string, code?: string): void {
    const error: SocketError = { message };
    if (code) {
      error.code = code;
    }
    socket.emit("error", error);
  }

  /**
   * Helper: Emit error from exception
   */
  private emitErrorFromException(socket: AuthenticatedSocket, error: unknown, defaultCode: string): void {
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    this.emitError(socket, message, defaultCode);
  }

  /**
   * Handles new Socket.IO connection
   * Supports both authenticated and anonymous users for public rooms
   */
  handleConnection = (socket: AuthenticatedSocket): void => {
    // Create user if not exists (for anonymous connections)
    if (!socket.user) {
      socket.user = {
        uid: `anonymous_${socket.id}`,
        name: `Guest ${socket.id.substring(0, 8)}`,
        email: undefined,
        picture: undefined
      };
    }

    const userType = socket.user.uid.startsWith('anonymous_') ? 'anonymous' : 'authenticated';
    this.logger.info(`User ${socket.user.uid} (${userType}) connected (socket: ${socket.id})`);
    this.registerEventHandlers(socket);
    socket.on("disconnect", () => this.handleDisconnection(socket));
  };

  /**
   * Helper: Validate user is in room (works for both authenticated and anonymous users)
   */
  private async validateUserInRoom(
    socket: AuthenticatedSocket,
    roomId: string
  ): Promise<VideoRoom | null> {
    if (!socket.user) {
      this.emitError(socket, "User not identified", "USER_NOT_IDENTIFIED");
      return null;
    }

    const room = await VideoService.getRoom(roomId);
    if (!room) {
      this.emitError(socket, "Room not found", "ROOM_NOT_FOUND");
      return null;
    }

    // For public rooms, check if user is in participants list
    if (!room.participants.includes(socket.user.uid)) {
      this.emitError(socket, "Not in room", "NOT_IN_ROOM");
      return null;
    }

    return room;
  }

  /**
   * Helper: Add user to chat room if video room has associated chat
   */
  private async addUserToChatRoom(roomId: string, userId: string): Promise<void> {
    const room = await VideoService.getRoom(roomId);
    if (!room?.chatRoomId) return;

    try {
      const chatRoomRef = firestore.collection("rooms").doc(room.chatRoomId);
      const chatRoomDoc = await chatRoomRef.get();

      if (chatRoomDoc.exists) {
        const chatRoomData = chatRoomDoc.data();
        const participants = chatRoomData?.participants || [];

        if (!participants.includes(userId)) {
          await chatRoomRef.update({
            participants: [...participants, userId],
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to add user to chat room: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Registers all Socket.IO event handlers
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

    socket.on("video:screen:start", (data: { roomId: string }) => {
      this.handleScreenStart(socket, data);
    });

    socket.on("video:screen:stop", (data: { roomId: string }) => {
      this.handleScreenStop(socket, data);
    });

    socket.on("video:stream:ready", (data: { 
      roomId: string; 
      hasVideo: boolean; 
      hasAudio: boolean; 
      isScreenSharing?: boolean;
      streamId?: string; // ID del stream para distinguir múltiples streams
    }) => {
      this.handleStreamReady(socket, data);
    });

    socket.on("video:room:end", (data: { roomId: string }) => {
      this.handleEndRoom(socket, data);
    });

    // Debug event: log all incoming signals (can be disabled in production)
    socket.onAny((eventName) => {
      if (eventName.startsWith("video:")) {
        this.logger.debug(`Received event: ${eventName} from ${socket.user?.uid || "unknown"}`);
      }
    });
  };

  /**
   * Handle user disconnection
   */
  private handleDisconnection = (socket: AuthenticatedSocket): void => {
    if (!socket.user) return;

    const userRooms = this.connectedUsers.get(socket.user.uid);
    if (userRooms) {
      for (const [roomId] of userRooms) {
        this.leaveRoom(socket.user.uid, roomId);
      }
      this.connectedUsers.delete(socket.user.uid);
    }

    this.logger.info(`User ${socket.user.uid} disconnected`);
  };

  /**
   * Handles creating a new video room (public by default, no auth required)
   */
  private handleCreateRoom = async (
    socket: AuthenticatedSocket,
    data: CreateVideoRoomData
  ): Promise<void> => {
    if (!socket.user) {
      socket.user = {
        uid: `anonymous_${socket.id}`,
        name: `Guest ${socket.id.substring(0, 8)}`,
        email: undefined,
        picture: undefined
      };
    }

    try {
      // Force public rooms and max 8 participants
      const roomData = {
        ...data,
        visibility: "public" as const,
        maxParticipants: 8
      };
      const room = await VideoService.createRoom(roomData, socket.user.uid);

      if (!this.connectedUsers.has(socket.user.uid)) {
        this.connectedUsers.set(socket.user.uid, new Map());
      }
      this.connectedUsers.get(socket.user.uid)?.set(room.id, socket.id);

      await socket.join(room.id);
      await VideoService.addParticipant(
        room.id,
        socket.user.uid,
        socket.id,
        socket.user.name,
        socket.user.email
      );

      socket.emit("video:room:created", room);
      this.logger.info(`Room ${room.id} created by ${socket.user.uid}`);
    } catch (error) {
      this.logger.error(`Failed to create room: ${error instanceof Error ? error.message : "Unknown error"}`);
      this.emitErrorFromException(socket, error, "CREATE_ROOM_ERROR");
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
    // Allow anonymous users for public rooms
    if (!socket.user) {
      socket.user = {
        uid: `anonymous_${socket.id}`,
        name: `Guest ${socket.id.substring(0, 8)}`,
        email: undefined,
        picture: undefined
      };
    }

    try {
      const { roomId, code } = data;

      // Buscar sala por código o por ID
      let room = null;
      if (code) {
        room = await VideoService.getRoomByCode(code);
      } else if (roomId) {
        room = await VideoService.getRoom(roomId);
      }

      if (!room) {
        this.emitError(socket, "Room not found", "ROOM_NOT_FOUND");
        return;
      }

      const actualRoomId = room.id;

      if (room.participants.length >= (room.maxParticipants || 8)) {
        this.emitError(socket, "Room is full (máximo 8 participantes)", "ROOM_FULL");
        return;
      }

      if (!this.connectedUsers.has(socket.user.uid)) {
        this.connectedUsers.set(socket.user.uid, new Map());
      }
      this.connectedUsers.get(socket.user.uid)?.set(actualRoomId, socket.id);

      await socket.join(actualRoomId);

      await VideoService.addParticipant(
        actualRoomId,
        socket.user.uid,
        socket.id,
        socket.user.name || undefined,
        socket.user.email || undefined
      );

      await this.addUserToChatRoom(actualRoomId, socket.user.uid);

      const participants = await VideoService.getRoomParticipants(actualRoomId);

      // Notify existing participants about the new user joining
      socket.to(actualRoomId).emit("video:user:joined", {
        roomId: actualRoomId,
        userId: socket.user.uid,
        userName: socket.user.name,
        userEmail: socket.user.email,
        socketId: socket.id,
        isAudioEnabled: true,
        isVideoEnabled: true,
        isScreenSharing: false,
        timestamp: new Date().toISOString()
      });

      // Send room info and existing participants to the new user
      // This allows the client to establish peer connections with existing participants
      socket.emit("video:room:joined", {
        roomId: actualRoomId,
        room,
        participants: participants.map(p => ({
          userId: p.userId,
          socketId: p.socketId,
          userName: p.userName,
          userEmail: p.userEmail,
          isAudioEnabled: p.isAudioEnabled,
          isVideoEnabled: p.isVideoEnabled,
          isScreenSharing: p.isScreenSharing
        }))
      });

      this.logger.info(
        `User ${socket.user.uid} joined room ${actualRoomId} (${participants.length}/${room.maxParticipants || 8} participants)`
      );
    } catch (error) {
      this.emitErrorFromException(socket, error, "JOIN_ROOM_ERROR");
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
      socket.user = {
        uid: `anonymous_${socket.id}`,
        name: `Guest ${socket.id.substring(0, 8)}`,
        email: undefined,
        picture: undefined
      };
    }

    try {
      const { roomId, code } = data;
      
      let actualRoomId = roomId;
      if (!actualRoomId && code) {
        const room = await VideoService.getRoomByCode(code);
        if (room) {
          actualRoomId = room.id;
        }
      }

      if (!actualRoomId) {
        return;
      }

      await socket.leave(actualRoomId);
      await this.leaveRoom(socket.user.uid, actualRoomId);

      socket.emit("video:room:left", { roomId });
      this.logger.info(`User ${socket.user.uid} left video room ${actualRoomId}`);
    } catch (error) {
      this.emitErrorFromException(socket, error, "LEAVE_ROOM_ERROR");
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
   * This is critical for establishing peer-to-peer connections for video and audio
   * Works for both authenticated and anonymous users
   */
  private handleSignal = async (
    socket: AuthenticatedSocket,
    data: VideoSignalData
  ): Promise<void> => {
    if (!socket.user) {
      socket.user = {
        uid: `anonymous_${socket.id}`,
        name: `Guest ${socket.id.substring(0, 8)}`,
        email: undefined,
        picture: undefined
      };
    }

    try {
      const { type, roomId, targetUserId, data: signalData, metadata } = data;

      // Validate signal type
      if (!["offer", "answer", "ice-candidate"].includes(type)) {
        this.logger.warn(`Invalid signal type: ${type} from user ${socket.user.uid}`);
        this.emitError(socket, "Invalid signal type", "INVALID_SIGNAL_TYPE");
        return;
      }

      if (!signalData) {
        this.logger.warn(`Missing signal data from user ${socket.user.uid}`);
        this.emitError(socket, "Missing signal data", "MISSING_SIGNAL_DATA");
        return;
      }

      if (!isValidSignal(signalData)) {
        this.logger.warn(`Invalid signal data structure from user ${socket.user.uid}`);
        this.emitError(socket, "Invalid signal data structure", "INVALID_SIGNAL_STRUCTURE");
        return;
      }

      const room = await VideoService.getRoom(roomId);
      if (!room) {
        this.logger.warn(`Room ${roomId} not found for signal from user ${socket.user.uid}`);
        this.emitError(socket, "Room not found", "ROOM_NOT_FOUND");
        return;
      }

      if (!room.participants.includes(socket.user.uid)) {
        this.logger.warn(`User ${socket.user.uid} not in room ${roomId}`);
        this.emitError(socket, "Not in room", "NOT_IN_ROOM");
        return;
      }

      // Get sender participant info to include stream state in metadata
      const senderParticipant = await VideoService.getParticipant(roomId, socket.user.uid);
      const isScreenSharing = senderParticipant?.isScreenSharing || metadata?.isScreenSharing || false;
      const streamType = isScreenSharing ? "screen" : "camera";
      
      const enhancedMetadata = {
        ...metadata,
        isScreenSharing,
        streamType,
        hasVideo: senderParticipant?.isVideoEnabled ?? metadata?.hasVideo ?? true,
        hasAudio: senderParticipant?.isAudioEnabled ?? metadata?.hasAudio ?? true,
        videoEnabled: senderParticipant?.isVideoEnabled ?? metadata?.videoEnabled ?? true,
        audioEnabled: senderParticipant?.isAudioEnabled ?? metadata?.audioEnabled ?? true
      };

      // Log signal for debugging (especially important for screen sharing)
      if (type !== "ice-candidate") {
        this.logger.info(
          `Signal ${type} from ${socket.user.uid} in room ${roomId} ` +
          `(stream: ${streamType}, screen: ${isScreenSharing}) ` +
          `${targetUserId ? `to ${targetUserId}` : "broadcast"}`
        );
      }

      // Prepare signal payload compatible with PeerJS
      // PeerJS expects: { type, roomId, fromUserId, data: { type, sdp } or { candidate, ... }, metadata }
      const signalPayload = {
        type,
        roomId,
        fromUserId: socket.user.uid,
        fromUserName: socket.user.name,
        fromUserEmail: socket.user.email,
        data: signalData,
        metadata: enhancedMetadata,
        timestamp: new Date().toISOString()
      };

      // Forward signal to target user or broadcast to all in room
      if (targetUserId) {
        // Send to specific user (peer-to-peer)
        const targetParticipant = await VideoService.getParticipant(roomId, targetUserId);
        if (!targetParticipant) {
          this.emitError(socket, "Target user not found in room", "TARGET_USER_NOT_FOUND");
          return;
        }
        this.logger.info(
          `Forwarding ${type} signal from ${socket.user.uid} to ${targetUserId} ` +
          `(socket: ${targetParticipant.socketId}, stream: ${streamType}, screen: ${isScreenSharing})`
        );
        this.io.to(targetParticipant.socketId).emit("video:signal", signalPayload);
      } else {
        // Broadcast to all participants in room except sender
        const socketsInRoom = await this.io.in(roomId).fetchSockets();
        const targetSockets = socketsInRoom.filter(s => s.id !== socket.id);
        this.logger.info(
          `Broadcasting ${type} signal from ${socket.user.uid} to ${targetSockets.length} participant(s) ` +
          `(stream: ${streamType}, screen: ${isScreenSharing})`
        );
        socket.to(roomId).emit("video:signal", signalPayload);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle signal from ${socket.user?.uid}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      this.emitErrorFromException(socket, error, "SIGNAL_ERROR");
    }
  };

  /**
   * Handle stream ready event (client notifies that their media stream is ready)
   * Supports multiple streams: camera video + screen sharing simultaneously
   */
  private handleStreamReady = async (
    socket: AuthenticatedSocket,
    data: { 
      roomId: string; 
      hasVideo: boolean; 
      hasAudio: boolean; 
      isScreenSharing?: boolean;
      streamId?: string;
    }
  ): Promise<void> => {
    if (!socket.user) {
      socket.user = {
        uid: `anonymous_${socket.id}`,
        name: `Guest ${socket.id.substring(0, 8)}`,
        email: undefined,
        picture: undefined
      };
    }

    try {
      // Verify user is in the room
      const room = await this.validateUserInRoom(socket, data.roomId);
      if (!room) return;

      // Update screen sharing state if provided
      if (data.isScreenSharing !== undefined) {
        await VideoService.updateParticipantState(data.roomId, socket.user.uid, {
          isScreenSharing: data.isScreenSharing
        });
        this.logger.info(
          `User ${socket.user.uid} stream ready - Screen sharing: ${data.isScreenSharing}, ` +
          `Video: ${data.hasVideo}, Audio: ${data.hasAudio}`
        );
      }

      // Notify others that this user's stream is ready
      // Include streamId to support multiple simultaneous streams (camera + screen)
      socket.to(data.roomId).emit("video:stream:ready", {
        roomId: data.roomId,
        userId: socket.user.uid,
        userName: socket.user.name,
        userEmail: socket.user.email,
        hasVideo: data.hasVideo,
        hasAudio: data.hasAudio,
        isScreenSharing: data.isScreenSharing || false,
        streamId: data.streamId || `stream-${socket.user.uid}-${Date.now()}`,
        streamType: data.isScreenSharing ? "screen" : "camera",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error(
        `Failed to handle stream ready: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      this.emitErrorFromException(socket, error, "STREAM_READY_ERROR");
    }
  };

  /**
   * Helper: Toggle participant state and notify room
   */
  private async toggleParticipantState(
    socket: AuthenticatedSocket,
    roomId: string,
    updates: { isAudioEnabled?: boolean; isVideoEnabled?: boolean; isScreenSharing?: boolean },
    eventName: string
  ): Promise<void> {
    if (!socket.user) return;

    try {
      await VideoService.updateParticipantState(roomId, socket.user.uid, updates);
      socket.to(roomId).emit(eventName, {
        roomId,
        userId: socket.user.uid,
        ...updates
      });
    } catch (error) {
      this.logger.error(`Failed to toggle state: ${error instanceof Error ? error.message : "Unknown error"}`);
      this.emitErrorFromException(socket, error, `${eventName.toUpperCase()}_ERROR`);
    }
  }

  /**
   * Handle toggling audio
   */
  private handleToggleAudio = async (
    socket: AuthenticatedSocket,
    data: { roomId: string; enabled: boolean }
  ): Promise<void> => {
    await this.toggleParticipantState(
      socket,
      data.roomId,
      { isAudioEnabled: data.enabled },
      "video:audio:toggled"
    );
  };

  /**
   * Handle toggling video
   */
  private handleToggleVideo = async (
    socket: AuthenticatedSocket,
    data: { roomId: string; enabled: boolean }
  ): Promise<void> => {
    await this.toggleParticipantState(
      socket,
      data.roomId,
      { isVideoEnabled: data.enabled },
      "video:video:toggled"
    );
  };

  /**
   * Handle toggling screen sharing
   */
  private handleToggleScreen = async (
    socket: AuthenticatedSocket,
    data: { roomId: string; enabled: boolean }
  ): Promise<void> => {
    if (!socket.user) return;

    const room = await this.validateUserInRoom(socket, data.roomId);
    if (!room) return;

    try {
      await VideoService.updateParticipantState(data.roomId, socket.user.uid, {
        isScreenSharing: data.enabled
      });

      this.logger.info(
        `User ${socket.user.uid} ${data.enabled ? "started" : "stopped"} screen sharing in room ${data.roomId}`
      );

      const payload = {
        roomId: data.roomId,
        userId: socket.user.uid,
        userName: socket.user.name,
        userEmail: socket.user.email,
        enabled: data.enabled,
        isScreenSharing: data.enabled,
        timestamp: new Date().toISOString()
      };

      // Notify others in the room about screen sharing state change
      socket.to(data.roomId).emit("video:screen:toggled", payload);
      socket.emit("video:screen:toggled", payload);
      
      // Emit negotiation event to trigger new peer connection for screen sharing
      if (data.enabled) {
        this.logger.info(`Triggering screen sharing negotiation for user ${socket.user.uid}`);
        socket.to(data.roomId).emit("video:screen:negotiation:needed", {
          roomId: data.roomId,
          userId: socket.user.uid,
          userName: socket.user.name,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error(`Failed to toggle screen: ${error instanceof Error ? error.message : "Unknown error"}`);
      this.emitErrorFromException(socket, error, "TOGGLE_SCREEN_ERROR");
    }
  };

  /**
   * Helper: Handle screen sharing start/stop events
   */
  private async handleScreenEvent(
    socket: AuthenticatedSocket,
    roomId: string,
    enabled: boolean,
    eventName: string
  ): Promise<void> {
    if (!socket.user) return;

    const room = await this.validateUserInRoom(socket, roomId);
    if (!room) return;

    try {
      await VideoService.updateParticipantState(roomId, socket.user.uid, {
        isScreenSharing: enabled
      });

      this.logger.info(
        `User ${socket.user.uid} screen sharing ${enabled ? "started" : "stopped"} in room ${roomId}`
      );

      const payload = {
        roomId,
        userId: socket.user.uid,
        userName: socket.user.name,
        userEmail: socket.user.email,
        isScreenSharing: enabled,
        timestamp: new Date().toISOString()
      };

      socket.to(roomId).emit(eventName, payload);
      socket.emit(eventName, { ...payload, userName: undefined, userEmail: undefined });
      
      // Trigger negotiation when starting screen sharing
      if (enabled && eventName === "video:screen:started") {
        this.logger.info(`Triggering negotiation for screen sharing from ${socket.user.uid}`);
        socket.to(roomId).emit("video:screen:negotiation:needed", {
          roomId,
          userId: socket.user.uid,
          userName: socket.user.name,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error(`Failed to handle screen event: ${error instanceof Error ? error.message : "Unknown error"}`);
      this.emitErrorFromException(socket, error, `${eventName.toUpperCase()}_ERROR`);
    }
  }

  /**
   * Handle screen sharing start event
   */
  private handleScreenStart = async (
    socket: AuthenticatedSocket,
    data: { roomId: string }
  ): Promise<void> => {
    await this.handleScreenEvent(socket, data.roomId, true, "video:screen:started");
  };

  /**
   * Handle screen sharing stop event
   */
  private handleScreenStop = async (
    socket: AuthenticatedSocket,
    data: { roomId: string }
  ): Promise<void> => {
    await this.handleScreenEvent(socket, data.roomId, false, "video:screen:stopped");
  };

  /**
   * Handle ending a room (host only)
   */
  private handleEndRoom = async (
    socket: AuthenticatedSocket,
    data: { roomId: string }
  ): Promise<void> => {
    if (!socket.user) {
      socket.user = {
        uid: `anonymous_${socket.id}`,
        name: `Guest ${socket.id.substring(0, 8)}`,
        email: undefined,
        picture: undefined
      };
    }
    
    // Only room host can end the room
    const room = await VideoService.getRoom(data.roomId);
    if (!room || room.hostId !== socket.user.uid) {
      this.emitError(socket, "Only room host can end the room", "UNAUTHORIZED");
      return;
    }

    try {
      await VideoService.endRoom(data.roomId, socket.user.uid);

      // Notify all participants
      this.io.to(data.roomId).emit("video:room:ended", {
        roomId: data.roomId
      });

      const sockets = await this.io.in(data.roomId).fetchSockets();
      sockets.forEach(s => s.leave(data.roomId));

      this.logger.info(`Room ${data.roomId} ended by ${socket.user.uid}`);
    } catch (error) {
      this.emitErrorFromException(socket, error, "END_ROOM_ERROR");
    }
  };

}


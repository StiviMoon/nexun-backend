import { Server as SocketIOServer } from "socket.io";
import { AuthenticatedSocket } from "../../../../shared/middleware/socketAuthMiddleware";
import { VideoService } from "../services/videoService";
import {
  JoinVideoRoomData,
  CreateVideoRoomData,
  VideoSignalData
} from "../../../../shared/types/video";
import { Logger } from "../../../../shared/utils/logger";

/**
 * video controller (corregido)
 *
 * cambios principales:
 * - exige targetUserId para offer/answer
 * - dedup de señales por hash simple
 * - reenvio dirigido con io.to(socketId).emit(...)
 * - logs y errores claros
 */

export class VideoController {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Map<string, string>> = new Map(); // userId -> Map<roomId, socketId>
  private logger: Logger;

  // recent signals per room (para evitar reenviar duplicados en ventana corta)
  // estructura: roomId -> set(signalId)
  private recentSignals: Map<string, Set<string>> = new Map();
  private RECENT_SIGNAL_TTL_MS = 5000; // ventana para considerar duplicado (5s)

  constructor(io: SocketIOServer) {
    this.io = io;
    this.logger = new Logger("video-service");
  }

  handleConnection = (socket: AuthenticatedSocket): void => {
    if (!socket.user) {
      socket.disconnect();
      return;
    }

    const userId = socket.user.uid;
    this.logger.info(`user ${userId} connected to video service (socket: ${socket.id})`);

    this.registerEventHandlers(socket);

    socket.on("disconnect", () => {
      this.handleDisconnection(socket);
    });
  };

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

    socket.on("video:stream:ready", (data: { roomId: string; hasVideo: boolean; hasAudio: boolean }) => {
      this.handleStreamReady(socket, data);
    });

    socket.on("video:room:end", (data: { roomId: string }) => {
      this.handleEndRoom(socket, data);
    });
  };

  private handleDisconnection = (socket: AuthenticatedSocket): void => {
    if (!socket.user) return;

    const userId = socket.user.uid;
    const userRooms = this.connectedUsers.get(userId);

    if (userRooms) {
      for (const [roomId] of userRooms) {
        this.leaveRoom(userId, roomId);
      }
      this.connectedUsers.delete(userId);
    }

    this.logger.info(`user ${userId} disconnected from video service`);
  };

  private handleCreateRoom = async (
    socket: AuthenticatedSocket,
    data: CreateVideoRoomData
  ): Promise<void> => {
    if (!socket.user) {
      socket.emit("error", { message: "unauthorized" });
      return;
    }

    try {
      this.logger.info(`creating video room: ${data.name} by user ${socket.user.uid}`);
      const room = await VideoService.createRoom(data, socket.user.uid);

      if (!this.connectedUsers.has(socket.user.uid)) {
        this.connectedUsers.set(socket.user.uid, new Map());
      }
      this.connectedUsers.get(socket.user.uid)?.set(room.id, socket.id);

      await socket.join(room.id);

      await VideoService.addParticipant(
        room.id,
        socket.user.uid,
        socket.id,
        socket.user.name || undefined,
        socket.user.email || undefined
      );

      socket.emit("video:room:created", room);
      this.logger.info(`video room ${room.id} created by ${socket.user.uid}`);
    } catch (error) {
      this.logger.error(`failed to create video room: ${error instanceof Error ? error.message : "unknown error"}`);
      socket.emit("error", { message: error instanceof Error ? error.message : "failed to create room", code: "CREATE_ROOM_ERROR" });
    }
  };

  private handleJoinRoom = async (
    socket: AuthenticatedSocket,
    data: JoinVideoRoomData
  ): Promise<void> => {
    if (!socket.user) {
      socket.emit("error", { message: "unauthorized" });
      return;
    }

    try {
      const { roomId, code } = data;

      let room = null;
      if (code) {
        room = await VideoService.getRoomByCode(code);
      } else if (roomId) {
        room = await VideoService.getRoom(roomId);
      }

      if (!room) {
        socket.emit("error", { message: "room not found", code: "ROOM_NOT_FOUND" });
        return;
      }

      const actualRoomId = room.id;

      if (room.participants.length >= (room.maxParticipants || 10)) {
        socket.emit("error", { message: "room is full", code: "ROOM_FULL" });
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

      // notify existing participants about new user
      socket.to(actualRoomId).emit("video:user:joined", {
        roomId: actualRoomId,
        userId: socket.user.uid,
        userName: socket.user.name,
        userEmail: socket.user.email,
        socketId: socket.id,
        isAudioEnabled: true,
        isVideoEnabled: true
      });

      const participants = await VideoService.getRoomParticipants(actualRoomId);

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

      this.logger.info(`user ${socket.user.uid} joined room ${actualRoomId}`);
    } catch (error) {
      socket.emit("error", { message: error instanceof Error ? error.message : "failed to join room", code: "JOIN_ROOM_ERROR" });
    }
  };

  private handleLeaveRoom = async (
    socket: AuthenticatedSocket,
    data: JoinVideoRoomData
  ): Promise<void> => {
    if (!socket.user) return;

    try {
      const { roomId, code } = data;
      let actualRoomId = roomId;
      if (!actualRoomId && code) {
        const room = await VideoService.getRoomByCode(code);
        if (room) actualRoomId = room.id;
      }
      if (!actualRoomId) return;

      await socket.leave(actualRoomId);
      await this.leaveRoom(socket.user.uid, actualRoomId);

      socket.emit("video:room:left", { roomId: actualRoomId });
      this.logger.info(`user ${socket.user.uid} left video room ${actualRoomId}`);
    } catch (error) {
      socket.emit("error", { message: error instanceof Error ? error.message : "failed to leave room", code: "LEAVE_ROOM_ERROR" });
    }
  };

  private async leaveRoom(userId: string, roomId: string): Promise<void> {
    await VideoService.removeParticipant(roomId, userId);

    const userRooms = this.connectedUsers.get(userId);
    if (userRooms) {
      userRooms.delete(roomId);
      if (userRooms.size === 0) this.connectedUsers.delete(userId);
    }

    // notify others
    this.io.to(roomId).emit("video:user:left", { roomId, userId });
  }

  // helper: crea un id simple para dedupe de señales
  private makeSignalId(type: string, fromUserId: string, targetUserId?: string, payload?: any): string {
    // toma un fragmento del payload para ahorrar espacio
    const snippet = payload ? (typeof payload === "string" ? payload.slice(0, 200) : JSON.stringify(payload).slice(0, 200)) : "";
    return `${type}:${fromUserId}:${targetUserId || "broadcast"}:${snippet}`;
  }

  // helper: marcar señal como reciente y limpiar despues de ttl
  private markRecentSignal(roomId: string, signalId: string) {
    if (!this.recentSignals.has(roomId)) this.recentSignals.set(roomId, new Set());
    const set = this.recentSignals.get(roomId)!;
    set.add(signalId);
    setTimeout(() => {
      set.delete(signalId);
      if (set.size === 0) this.recentSignals.delete(roomId);
    }, this.RECENT_SIGNAL_TTL_MS);
  }

  private isRecentSignal(roomId: string, signalId: string): boolean {
    return this.recentSignals.has(roomId) && this.recentSignals.get(roomId)!.has(signalId);
  }

  /**
   * handleSignal: reenvio seguro de offer/answer/candidate
   */
  private handleSignal = async (
    socket: AuthenticatedSocket,
    data: VideoSignalData
  ): Promise<void> => {
    if (!socket.user) {
      socket.emit("error", { message: "unauthorized", code: "UNAUTHORIZED" });
      return;
    }

    try {
      const { type, roomId, targetUserId, data: signalData } = data as any;
      const fromUserId = socket.user.uid;

      // validacion basica
      if (!["offer", "answer", "ice-candidate"].includes(type)) {
        this.logger.warn(`invalid signal type: ${type} from ${fromUserId}`);
        socket.emit("error", { message: "invalid signal type", code: "INVALID_SIGNAL_TYPE" });
        return;
      }
      if (!roomId) {
        socket.emit("error", { message: "missing roomId", code: "MISSING_ROOM" });
        return;
      }
      if (!signalData) {
        socket.emit("error", { message: "missing signal data", code: "MISSING_SIGNAL_DATA" });
        return;
      }

      // obtener room y verificar participante
      const room = await VideoService.getRoom(roomId);
      if (!room) {
        socket.emit("error", { message: "room not found", code: "ROOM_NOT_FOUND" });
        return;
      }
      if (!room.participants.includes(fromUserId)) {
        socket.emit("error", { message: "not in room", code: "NOT_IN_ROOM" });
        return;
      }

      // si es offer/answer, exigir targetUserId para evitar broadcast de sdp
      if ((type === "offer" || type === "answer") && !targetUserId) {
        this.logger.warn(`rejecting ${type} without targetUserId from ${fromUserId} in room ${roomId}`);
        socket.emit("error", { message: "offer/answer must include targetUserId", code: "MUST_INCLUDE_TARGET" });
        return;
      }

      // dedupe simple: crear id y verificar si ya estuvo reciente
      const signalId = this.makeSignalId(type, fromUserId, targetUserId, signalData);
      if (this.isRecentSignal(roomId, signalId)) {
        this.logger.warn(`duplicate signal ignored (${type}) from ${fromUserId} in room ${roomId}`);
        return;
      }
      this.markRecentSignal(roomId, signalId);

      // construir payload que el cliente espera
      const signalPayload = {
        type,
        roomId,
        fromUserId,
        data: signalData,
        metadata: (data as any).metadata || {}
      };

      // reenvio dirigido si targetUserId existe
      if (targetUserId) {
        const participant = await VideoService.getParticipant(roomId, targetUserId);
        if (participant && participant.socketId) {
          this.logger.info(`forwarding ${type} from ${fromUserId} to ${targetUserId} (socket ${participant.socketId}) in room ${roomId}`);
          // enviar directamente al socket objetivo
          this.io.to(participant.socketId).emit("video:signal", signalPayload);
        } else {
          this.logger.warn(`target participant ${targetUserId} not found in room ${roomId}`);
          socket.emit("error", { message: "target user not found in room", code: "TARGET_USER_NOT_FOUND" });
        }
        return;
      }

      // si no hay targetUserId:
      // permitir reenvio solo para ice-candidate como broadcast a todos excepto emisor
      if (type === "ice-candidate") {
        const socketsInRoom = await this.io.in(roomId).fetchSockets();
        const targetSockets = socketsInRoom.filter(s => s.id !== socket.id);
        this.logger.info(`broadcasting ice-candidate from ${fromUserId} to ${targetSockets.length} sockets in room ${roomId}`);
        targetSockets.forEach(s => {
          this.io.to(s.id).emit("video:signal", signalPayload);
        });
        return;
      }

      // si llegamos aqui, tipo no permitido sin target
      socket.emit("error", { message: "signal type requires targetUserId", code: "SIGNAL_REQUIRES_TARGET" });
    } catch (error) {
      this.logger.error(`failed to handle signal from ${socket.user?.uid}: ${error instanceof Error ? error.message : "unknown error"}`);
      socket.emit("error", { message: error instanceof Error ? error.message : "failed to send signal", code: "SIGNAL_ERROR" });
    }
  };

  private handleStreamReady = async (
    socket: AuthenticatedSocket,
    data: { roomId: string; hasVideo: boolean; hasAudio: boolean }
  ): Promise<void> => {
    if (!socket.user) return;

    try {
      socket.to(data.roomId).emit("video:stream:ready", {
        roomId: data.roomId,
        userId: socket.user.uid,
        hasVideo: data.hasVideo,
        hasAudio: data.hasAudio
      });
    } catch (error) {
      this.logger.error(`failed to handle stream ready: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  };

  private handleToggleAudio = async (
    socket: AuthenticatedSocket,
    data: { roomId: string; enabled: boolean }
  ): Promise<void> => {
    if (!socket.user) return;
    try {
      await VideoService.updateParticipantState(data.roomId, socket.user.uid, { isAudioEnabled: data.enabled });
      socket.to(data.roomId).emit("video:audio:toggled", { roomId: data.roomId, userId: socket.user.uid, enabled: data.enabled });
    } catch (error) {
      this.logger.error(`failed to toggle audio: ${error instanceof Error ? error.message : "unknown error"}`);
      socket.emit("error", { message: error instanceof Error ? error.message : "failed to toggle audio", code: "TOGGLE_AUDIO_ERROR" });
    }
  };

  private handleToggleVideo = async (
    socket: AuthenticatedSocket,
    data: { roomId: string; enabled: boolean }
  ): Promise<void> => {
    if (!socket.user) return;
    try {
      await VideoService.updateParticipantState(data.roomId, socket.user.uid, { isVideoEnabled: data.enabled });
      socket.to(data.roomId).emit("video:video:toggled", { roomId: data.roomId, userId: socket.user.uid, enabled: data.enabled });
    } catch (error) {
      this.logger.error(`failed to toggle video: ${error instanceof Error ? error.message : "unknown error"}`);
      socket.emit("error", { message: error instanceof Error ? error.message : "failed to toggle video", code: "TOGGLE_VIDEO_ERROR" });
    }
  };

  private handleToggleScreen = async (
    socket: AuthenticatedSocket,
    data: { roomId: string; enabled: boolean }
  ): Promise<void> => {
    if (!socket.user) return;
    try {
      await VideoService.updateParticipantState(data.roomId, socket.user.uid, { isScreenSharing: data.enabled });
      socket.to(data.roomId).emit("video:screen:toggled", { roomId: data.roomId, userId: socket.user.uid, enabled: data.enabled });
    } catch (error) {
      this.logger.error(`failed to toggle screen: ${error instanceof Error ? error.message : "unknown error"}`);
      socket.emit("error", { message: error instanceof Error ? error.message : "failed to toggle screen", code: "TOGGLE_SCREEN_ERROR" });
    }
  };

  private handleEndRoom = async (
    socket: AuthenticatedSocket,
    data: { roomId: string }
  ): Promise<void> => {
    if (!socket.user) {
      socket.emit("error", { message: "unauthorized" });
      return;
    }

    try {
      await VideoService.endRoom(data.roomId, socket.user.uid);
      this.io.to(data.roomId).emit("video:room:ended", { roomId: data.roomId });
      const sockets = await this.io.in(data.roomId).fetchSockets();
      sockets.forEach(s => s.leave(data.roomId));
      this.logger.info(`video room ${data.roomId} ended by ${socket.user.uid}`);
    } catch (error) {
      socket.emit("error", { message: error instanceof Error ? error.message : "failed to end room", code: "END_ROOM_ERROR" });
    }
  };
}

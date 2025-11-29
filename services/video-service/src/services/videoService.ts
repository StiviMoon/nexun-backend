import { firestore } from "../shared/config/firebase";
import { VideoRoom, VideoParticipant, CreateVideoRoomData } from "../shared/types/video";
import * as admin from "firebase-admin";

export class VideoService {
  private static readonly VIDEO_ROOMS_COLLECTION = "videoRooms";
  private static readonly PARTICIPANTS_COLLECTION = "videoParticipants";

  /**
   * Convert Firestore timestamp to Date
   */
  private static convertToDate(timestamp: unknown): Date {
    if (!timestamp) {
      return new Date();
    }

    if (timestamp instanceof Date) {
      return timestamp;
    }

    if (timestamp && typeof timestamp === "object" && "toDate" in timestamp && typeof (timestamp as { toDate: () => Date }).toDate === "function") {
      return (timestamp as { toDate: () => Date }).toDate();
    }

    if (typeof timestamp === "number") {
      return timestamp > 1e12 ? new Date(timestamp) : new Date(timestamp * 1000);
    }

    if (typeof timestamp === "string") {
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return new Date();
  }

  /**
   * Creates a new video room in Firestore
   * @param data - Room creation data (name, description, maxParticipants)
   * @param hostId - User ID of the room host
   * @returns Created video room
   * @throws Error if room creation fails
   */
  static async createRoom(
    data: CreateVideoRoomData,
    hostId: string
  ): Promise<VideoRoom> {
    try {
      const roomId = firestore.collection(this.VIDEO_ROOMS_COLLECTION).doc().id;
      const now = new Date();

      // Siempre generar código único de 6 caracteres para todas las salas
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let roomCode = "";
      for (let i = 0; i < 6; i++) {
        roomCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Crear chat privado asociado si se solicita
      let chatRoomId: string | undefined;
      let chatRoomCode: string | undefined;
      if (data.createChat) {
        try {
          const chatRoomIdDoc = firestore.collection("rooms").doc();
          chatRoomId = chatRoomIdDoc.id;
          
          // Generar código para el chat privado
          let chatCode = "";
          for (let i = 0; i < 6; i++) {
            chatCode += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          chatRoomCode = chatCode;

          const chatRoom = {
            id: chatRoomId,
            name: `${data.name} - Chat`,
            description: `Chat privado para la reunión: ${data.name}`,
            type: "group",
            visibility: "private",
            code: chatCode,
            participants: [hostId],
            createdBy: hostId,
            videoRoomId: roomId,
            metadata: {
              videoRoomId: roomId,
              isVideoMeeting: true,
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };

          await chatRoomIdDoc.set(chatRoom);
          console.log(`✅ Chat room created: ${chatRoomId} (code: ${chatCode}) for video room: ${roomId}`);
        } catch (chatError) {
          // Si falla la creación del chat, continuar sin él (no crítico)
          console.warn(`⚠️ Failed to create associated chat room (continuing without chat): ${chatError instanceof Error ? chatError.message : "Unknown error"}`);
          // No lanzar error, continuar sin chat
        }
      }

      const room: VideoRoom = {
        id: roomId,
        name: data.name,
        description: data.description,
        hostId,
        participants: [hostId],
        maxParticipants: data.maxParticipants || 10, // Máximo 10 personas por defecto
        isRecording: false,
        visibility: data.visibility || "public",
        code: roomCode, // Siempre generar código
        chatRoomId, // ID del chat asociado
        chatRoomCode, // Código del chat asociado
        createdAt: now,
        updatedAt: now
      };

      const roomToSave = {
        ...room,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await firestore
        .collection(this.VIDEO_ROOMS_COLLECTION)
        .doc(roomId)
        .set(roomToSave);

      return room;
    } catch (error) {
      throw new Error(
        `Failed to create video room: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Gets a video room by code
   * @param code - Room code to retrieve
   * @returns Video room or null if not found
   */
  static async getRoomByCode(code: string): Promise<VideoRoom | null> {
    try {
      const snapshot = await firestore
        .collection(this.VIDEO_ROOMS_COLLECTION)
        .where("code", "==", code)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const roomDoc = snapshot.docs[0];
      const data = roomDoc.data();
      return {
        id: roomDoc.id,
        name: data?.name || "",
        description: data?.description,
        hostId: data?.hostId || "",
        participants: data?.participants || [],
        maxParticipants: data?.maxParticipants || 10,
        isRecording: data?.isRecording || false,
        visibility: data?.visibility || "public",
        code: data?.code,
        chatRoomId: data?.chatRoomId,
        chatRoomCode: data?.chatRoomCode,
        createdAt: this.convertToDate(data?.createdAt),
        updatedAt: this.convertToDate(data?.updatedAt)
      };
    } catch (error) {
      throw new Error(
        `Failed to get video room by code: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Gets a video room by ID
   * @param roomId - Room ID to retrieve
   * @returns Video room or null if not found
   */
  static async getRoom(roomId: string): Promise<VideoRoom | null> {
    try {
      const roomDoc = await firestore
        .collection(this.VIDEO_ROOMS_COLLECTION)
        .doc(roomId)
        .get();

      if (!roomDoc.exists) {
        return null;
      }

      const data = roomDoc.data();
      return {
        id: roomDoc.id,
        name: data?.name || "",
        description: data?.description,
        hostId: data?.hostId || "",
        participants: data?.participants || [],
        maxParticipants: data?.maxParticipants || 10,
        isRecording: data?.isRecording || false,
        visibility: data?.visibility || "public",
        code: data?.code,
        chatRoomId: data?.chatRoomId,
        chatRoomCode: data?.chatRoomCode,
        createdAt: this.convertToDate(data?.createdAt),
        updatedAt: this.convertToDate(data?.updatedAt)
      };
    } catch (error) {
      throw new Error(
        `Failed to get video room: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Adds a participant to a video room
   * @param roomId - Room ID
   * @param userId - User ID to add
   * @param socketId - Socket ID for WebRTC signaling
   * @param userName - User name (optional)
   * @param userEmail - User email (optional)
   * @throws Error if room is full or not found
   */
  static async addParticipant(
    roomId: string,
    userId: string,
    socketId: string,
    userName?: string,
    userEmail?: string
  ): Promise<void> {
    try {
      const roomRef = firestore
        .collection(this.VIDEO_ROOMS_COLLECTION)
        .doc(roomId);

      const room = await this.getRoom(roomId);
      if (!room) {
        throw new Error("Room not found");
      }

      // Check if room is full
      if (room.participants.length >= (room.maxParticipants || 10)) {
        throw new Error("Room is full");
      }

      // Add participant to room
      if (!room.participants.includes(userId)) {
        await roomRef.update({
          participants: admin.firestore.FieldValue.arrayUnion(userId),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Save participant details
      await firestore
        .collection(this.PARTICIPANTS_COLLECTION)
        .doc(`${roomId}_${userId}`)
        .set({
          roomId,
          userId,
          socketId,
          userName: userName || null,
          userEmail: userEmail || null,
          isAudioEnabled: true,
          isVideoEnabled: true,
          isScreenSharing: false,
          joinedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
      throw new Error(
        `Failed to add participant: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Remove a participant from a video room
   */
  static async removeParticipant(
    roomId: string,
    userId: string
  ): Promise<void> {
    try {
      const roomRef = firestore
        .collection(this.VIDEO_ROOMS_COLLECTION)
        .doc(roomId);

      await roomRef.update({
        participants: admin.firestore.FieldValue.arrayRemove(userId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Remove participant details
      await firestore
        .collection(this.PARTICIPANTS_COLLECTION)
        .doc(`${roomId}_${userId}`)
        .delete();
    } catch (error) {
      throw new Error(
        `Failed to remove participant: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get participant details
   */
  static async getParticipant(
    roomId: string,
    userId: string
  ): Promise<VideoParticipant | null> {
    try {
      const participantDoc = await firestore
        .collection(this.PARTICIPANTS_COLLECTION)
        .doc(`${roomId}_${userId}`)
        .get();

      if (!participantDoc.exists) {
        return null;
      }

      const data = participantDoc.data();
      return {
        userId: data?.userId || "",
        socketId: data?.socketId || "",
        userName: data?.userName || undefined,
        userEmail: data?.userEmail || undefined,
        isAudioEnabled: data?.isAudioEnabled ?? true,
        isVideoEnabled: data?.isVideoEnabled ?? true,
        isScreenSharing: data?.isScreenSharing ?? false,
        joinedAt: this.convertToDate(data?.joinedAt)
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Update participant state (audio/video/screen sharing)
   */
  static async updateParticipantState(
    roomId: string,
    userId: string,
    updates: Partial<Pick<VideoParticipant, "isAudioEnabled" | "isVideoEnabled" | "isScreenSharing">>
  ): Promise<void> {
    try {
      await firestore
        .collection(this.PARTICIPANTS_COLLECTION)
        .doc(`${roomId}_${userId}`)
        .update(updates);
    } catch (error) {
      throw new Error(
        `Failed to update participant state: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get all participants in a room
   */
  static async getRoomParticipants(roomId: string): Promise<VideoParticipant[]> {
    try {
      const snapshot = await firestore
        .collection(this.PARTICIPANTS_COLLECTION)
        .where("roomId", "==", roomId)
        .get();

      const participants: VideoParticipant[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        participants.push({
          userId: data.userId,
          socketId: data.socketId,
          userName: data.userName || undefined,
          userEmail: data.userEmail || undefined,
          isAudioEnabled: data.isAudioEnabled ?? true,
          isVideoEnabled: data.isVideoEnabled ?? true,
          isScreenSharing: data.isScreenSharing ?? false,
          joinedAt: this.convertToDate(data.joinedAt)
        });
      });

      return participants;
    } catch (error) {
      return [];
    }
  }

  /**
   * End a video room (remove all participants)
   */
  static async endRoom(roomId: string, hostId: string): Promise<void> {
    try {
      const room = await this.getRoom(roomId);
      if (!room || room.hostId !== hostId) {
        throw new Error("Unauthorized or room not found");
      }

      // Remove all participants
      const participants = await this.getRoomParticipants(roomId);
      for (const participant of participants) {
        await this.removeParticipant(roomId, participant.userId);
      }

      // Mark room as ended (optional: delete or mark with status)
      await firestore
        .collection(this.VIDEO_ROOMS_COLLECTION)
        .doc(roomId)
        .update({
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
      throw new Error(
        `Failed to end room: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}


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

      const room: VideoRoom = {
        id: roomId,
        name: data.name,
        description: data.description,
        hostId,
        participants: [hostId],
        maxParticipants: data.maxParticipants || 50,
        isRecording: false,
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
        maxParticipants: data?.maxParticipants || 50,
        isRecording: data?.isRecording || false,
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
   * @throws Error if room is full or not found
   */
  static async addParticipant(
    roomId: string,
    userId: string,
    socketId: string
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
      if (room.participants.length >= room.maxParticipants) {
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


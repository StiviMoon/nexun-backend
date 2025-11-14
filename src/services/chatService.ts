import { firestore } from "../config/firebase";
import { ChatMessage, ChatRoom, CreateRoomData } from "../types/chat";
import * as admin from "firebase-admin";

export class ChatService {
  private static readonly MESSAGES_COLLECTION = "messages";
  private static readonly ROOMS_COLLECTION = "rooms";
  private static readonly USERS_COLLECTION = "users";

  // Cache in-memory para mejorar tiempos de respuesta
  private static roomCache = new Map<string, { room: ChatRoom; timestamp: number }>();
  private static userRoomsCache = new Map<string, { rooms: ChatRoom[]; timestamp: number }>();
  private static readonly CACHE_TTL = 30000; // 30 segundos

  /**
   * Convert Firestore timestamp to Date, handling multiple formats
   */
  private static convertToDate(timestamp: unknown): Date {
    if (!timestamp) {
      return new Date();
    }

    // If it's already a Date
    if (timestamp instanceof Date) {
      return timestamp;
    }

    // If it's a Firestore Timestamp
    if (timestamp && typeof timestamp === "object" && "toDate" in timestamp && typeof (timestamp as { toDate: () => Date }).toDate === "function") {
      return (timestamp as { toDate: () => Date }).toDate();
    }

    // If it's a number (milliseconds or seconds)
    if (typeof timestamp === "number") {
      // Check if it's in seconds (Firestore timestamp) or milliseconds
      return timestamp > 1e12 ? new Date(timestamp) : new Date(timestamp * 1000);
    }

    // If it's a string, try to parse it
    if (typeof timestamp === "string") {
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    // Fallback to current date
    return new Date();
  }

  /**
   * Create a new chat room
   */
  static async createRoom(
    data: CreateRoomData,
    createdBy: string
  ): Promise<ChatRoom> {
    try {
      const roomId = firestore.collection(this.ROOMS_COLLECTION).doc().id;
      const now = new Date();

      const room: ChatRoom = {
        id: roomId,
        name: data.name,
        description: data.description,
        type: data.type,
        participants: data.participants
          ? [...new Set([createdBy, ...data.participants])]
          : [createdBy],
        createdBy,
        createdAt: now,
        updatedAt: now
      };

      const roomToSave = {
        ...room,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Remove undefined values before saving to Firestore
      const cleanedRoom = this.removeUndefinedValues(
        roomToSave as unknown as Record<string, unknown>
      );

      await firestore
        .collection(this.ROOMS_COLLECTION)
        .doc(roomId)
        .set(cleanedRoom);

      // Clear cache
      this.clearRoomCache(roomId);

      return room;
    } catch (error) {
      throw new Error(
        `Failed to create room: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Clear cache for a room
   */
  private static clearRoomCache(roomId: string): void {
    this.roomCache.delete(roomId);
    // Clear user rooms cache as it may contain this room
    this.userRoomsCache.clear();
  }

  /**
   * Get a room by ID (with cache)
   */
  static async getRoom(roomId: string): Promise<ChatRoom | null> {
    try {
      // Check cache first
      const cached = this.roomCache.get(roomId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.room;
      }

      const roomDoc = await firestore
        .collection(this.ROOMS_COLLECTION)
        .doc(roomId)
        .get();

      if (!roomDoc.exists) {
        return null;
      }

      const data = roomDoc.data();
      const room: ChatRoom = {
        id: roomDoc.id,
        name: data?.name || "",
        description: data?.description,
        type: data?.type || "group",
        participants: data?.participants || [],
        createdBy: data?.createdBy || "",
        createdAt: this.convertToDate(data?.createdAt),
        updatedAt: this.convertToDate(data?.updatedAt)
      };

      // Update cache
      this.roomCache.set(roomId, { room, timestamp: Date.now() });

      return room;
    } catch (error) {
      throw new Error(
        `Failed to get room: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Check if user is a participant in the room
   */
  static async isParticipant(
    roomId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const room = await this.getRoom(roomId);
      return room?.participants.includes(userId) || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Add a participant to a room
   */
  static async addParticipant(
    roomId: string,
    userId: string
  ): Promise<void> {
    try {
      const roomRef = firestore
        .collection(this.ROOMS_COLLECTION)
        .doc(roomId);

      await roomRef.update({
        participants: admin.firestore.FieldValue.arrayUnion(userId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Clear cache
      this.clearRoomCache(roomId);
    } catch (error) {
      throw new Error(
        `Failed to add participant: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Remove a participant from a room
   */
  static async removeParticipant(
    roomId: string,
    userId: string
  ): Promise<void> {
    try {
      const roomRef = firestore
        .collection(this.ROOMS_COLLECTION)
        .doc(roomId);

      await roomRef.update({
        participants: admin.firestore.FieldValue.arrayRemove(userId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Clear cache
      this.clearRoomCache(roomId);
    } catch (error) {
      throw new Error(
        `Failed to remove participant: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Remove undefined values from an object (Firestore doesn't accept undefined)
   */
  private static removeUndefinedValues(obj: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          // Recursively clean nested objects
          cleaned[key] = this.removeUndefinedValues(value as Record<string, unknown>);
        } else {
          cleaned[key] = value;
        }
      }
    }
    return cleaned;
  }

  /**
   * Save a message to Firestore
   */
  static async saveMessage(message: ChatMessage): Promise<ChatMessage> {
    try {
      const messageRef = firestore
        .collection(this.MESSAGES_COLLECTION)
        .doc();

      const messageToSave = {
        ...message,
        id: messageRef.id,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

      // Remove undefined values before saving to Firestore
      const cleanedMessage = this.removeUndefinedValues(
        messageToSave as unknown as Record<string, unknown>
      );

      await messageRef.set(cleanedMessage);

      // Update room's updatedAt timestamp
      await firestore
        .collection(this.ROOMS_COLLECTION)
        .doc(message.roomId)
        .update({
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

      // Clear cache for this room
      this.clearRoomCache(message.roomId);

      return {
        ...message,
        id: messageRef.id,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(
        `Failed to save message: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get messages for a room with pagination
   */
  static async getMessages(
    roomId: string,
    limit: number = 50,
    lastMessageId?: string
  ): Promise<ChatMessage[]> {
    try {
      let query = firestore
        .collection(this.MESSAGES_COLLECTION)
        .where("roomId", "==", roomId)
        .orderBy("timestamp", "desc")
        .limit(limit);

      if (lastMessageId) {
        const lastMessage = await firestore
          .collection(this.MESSAGES_COLLECTION)
          .doc(lastMessageId)
          .get();

        if (lastMessage.exists) {
          query = query.startAfter(lastMessage);
        }
      }

      const snapshot = await query.get();
      const messages: ChatMessage[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          roomId: data.roomId,
          senderId: data.senderId,
          senderName: data.senderName,
          senderPicture: data.senderPicture,
          content: data.content,
          timestamp: this.convertToDate(data.timestamp),
          type: data.type || "text",
          metadata: data.metadata
        } as ChatMessage);
      });

      return messages.reverse(); // Return in chronological order
    } catch (error) {
      // Si el error es por falta de índice, intentar sin orderBy como fallback
      if (error instanceof Error && error.message.includes("index")) {
        console.warn("Index not found, trying query without orderBy as fallback");
        try {
          const snapshot = await firestore
            .collection(this.MESSAGES_COLLECTION)
            .where("roomId", "==", roomId)
            .limit(limit * 2) // Obtener más para compensar la falta de orden
            .get();

          const messages: ChatMessage[] = [];

          snapshot.forEach((doc) => {
            const data = doc.data();
            messages.push({
              id: doc.id,
              roomId: data.roomId,
              senderId: data.senderId,
              senderName: data.senderName,
              senderPicture: data.senderPicture,
              content: data.content,
              timestamp: this.convertToDate(data.timestamp),
              type: data.type || "text",
              metadata: data.metadata
            } as ChatMessage);
          });

          // Ordenar manualmente por timestamp y limitar
          return messages
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
            .slice(-limit);
        } catch (fallbackError) {
          console.error("Fallback query also failed:", fallbackError);
          // Si el fallback también falla, devolver array vacío
          return [];
        }
      }
      throw new Error(
        `Failed to get messages: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get user's rooms (with cache)
   * Returns:
   * - All public rooms (type: "group" or "channel") - visible to everyone
   * - Private rooms (type: "direct") where user is a participant
   */
  static async getUserRooms(userId: string): Promise<ChatRoom[]> {
    try {
      // Check cache first for public rooms (shared across all users)
      const cached = this.userRoomsCache.get("public");
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        // Still need to fetch private rooms for this user
        const privateRooms = await this.getPrivateRooms(userId);
        const allRooms = [...cached.rooms, ...privateRooms];
        return allRooms.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      }

      const roomsMap = new Map<string, ChatRoom>();

      // Query 1: Get public rooms (group and channel) - visible to everyone
      try {
        const publicRoomsSnapshot = await firestore
          .collection(this.ROOMS_COLLECTION)
          .where("type", "in", ["group", "channel"])
          .orderBy("updatedAt", "desc")
          .get();

        publicRoomsSnapshot.forEach((doc) => {
          const data = doc.data();
          const room: ChatRoom = {
            id: doc.id,
            name: data.name || "",
            description: data.description,
            type: data.type || "group",
            participants: data.participants || [],
            createdBy: data.createdBy || "",
            createdAt: this.convertToDate(data.createdAt),
            updatedAt: this.convertToDate(data.updatedAt)
          };
          roomsMap.set(doc.id, room);
        });
      } catch (publicError) {
        // Si falla por falta de índice, intentar sin orderBy
        if (publicError instanceof Error && publicError.message.includes("index")) {
          console.warn("Index not found for public rooms, trying without orderBy");
          const publicRoomsSnapshot = await firestore
            .collection(this.ROOMS_COLLECTION)
            .where("type", "in", ["group", "channel"])
            .get();

          publicRoomsSnapshot.forEach((doc) => {
            const data = doc.data();
            const room: ChatRoom = {
              id: doc.id,
              name: data.name || "",
              description: data.description,
              type: data.type || "group",
              participants: data.participants || [],
              createdBy: data.createdBy || "",
              createdAt: this.convertToDate(data.createdAt),
              updatedAt: this.convertToDate(data.updatedAt)
            };
            roomsMap.set(doc.id, room);
          });
        } else {
          console.error("Error fetching public rooms:", publicError);
        }
      }

      // Query 2: Get private rooms (direct) where user is a participant
      try {
        const privateRoomsSnapshot = await firestore
          .collection(this.ROOMS_COLLECTION)
          .where("type", "==", "direct")
          .where("participants", "array-contains", userId)
          .orderBy("updatedAt", "desc")
          .get();

        privateRoomsSnapshot.forEach((doc) => {
          const data = doc.data();
          const room: ChatRoom = {
            id: doc.id,
            name: data.name || "",
            description: data.description,
            type: data.type || "direct",
            participants: data.participants || [],
            createdBy: data.createdBy || "",
            createdAt: this.convertToDate(data.createdAt),
            updatedAt: this.convertToDate(data.updatedAt)
          };
          roomsMap.set(doc.id, room);
        });
      } catch (privateError) {
        // Si falla por falta de índice, intentar sin orderBy
        if (privateError instanceof Error && privateError.message.includes("index")) {
          console.warn("Index not found for private rooms, trying without orderBy");
          const privateRoomsSnapshot = await firestore
            .collection(this.ROOMS_COLLECTION)
            .where("type", "==", "direct")
            .where("participants", "array-contains", userId)
            .get();

          privateRoomsSnapshot.forEach((doc) => {
            const data = doc.data();
            const room: ChatRoom = {
              id: doc.id,
              name: data.name || "",
              description: data.description,
              type: data.type || "direct",
              participants: data.participants || [],
              createdBy: data.createdBy || "",
              createdAt: this.convertToDate(data.createdAt),
              updatedAt: this.convertToDate(data.updatedAt)
            };
            roomsMap.set(doc.id, room);
          });
        } else {
          console.error("Error fetching private rooms:", privateError);
        }
      }

      // Convert map to array and sort by updatedAt
      const rooms = Array.from(roomsMap.values());
      const sortedRooms = rooms.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      // Cache public rooms (shared across all users)
      const publicRooms = sortedRooms.filter(r => r.type === "group" || r.type === "channel");
      if (publicRooms.length > 0) {
        this.userRoomsCache.set("public", { rooms: publicRooms, timestamp: Date.now() });
      }

      return sortedRooms;
    } catch (error) {
      throw new Error(
        `Failed to get user rooms: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get private rooms for a user (helper method)
   */
  private static async getPrivateRooms(userId: string): Promise<ChatRoom[]> {
    try {
      const privateRoomsSnapshot = await firestore
        .collection(this.ROOMS_COLLECTION)
        .where("type", "==", "direct")
        .where("participants", "array-contains", userId)
        .get();

      const rooms: ChatRoom[] = [];
      privateRoomsSnapshot.forEach((doc) => {
        const data = doc.data();
        rooms.push({
          id: doc.id,
          name: data.name || "",
          description: data.description,
          type: data.type || "direct",
          participants: data.participants || [],
          createdBy: data.createdBy || "",
          createdAt: this.convertToDate(data.createdAt),
          updatedAt: this.convertToDate(data.updatedAt)
        } as ChatRoom);
      });

      return rooms.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error("Error fetching private rooms:", error);
      return [];
    }
  }

  /**
   * Get user profile for chat
   */
  static async getUserProfile(uid: string): Promise<{
    uid: string;
    name?: string;
    email?: string;
    picture?: string;
  } | null> {
    try {
      const userDoc = await firestore
        .collection(this.USERS_COLLECTION)
        .doc(uid)
        .get();

      if (!userDoc.exists) {
        return null;
      }

      const data = userDoc.data();
      return {
        uid,
        name: data?.displayName || data?.name,
        email: data?.email,
        picture: data?.photoURL || data?.picture
      };
    } catch (error) {
      return null;
    }
  }
}


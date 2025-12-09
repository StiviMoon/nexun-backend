import { firestore } from "../shared/config/firebase";
import { ChatMessage, ChatRoom, CreateRoomData } from "../shared/types/chat";
import * as admin from "firebase-admin";


export class ChatService {
  private static readonly MESSAGES_COLLECTION = "messages";
  private static readonly ROOMS_COLLECTION = "rooms";
  private static readonly USERS_COLLECTION = "users";
  private static readonly CODE_LENGTH = 6;
  private static readonly CODE_REGEX = /^[A-Z0-9]{6,8}$/;

  // Cache in-memory para mejorar tiempos de respuesta
  private static roomCache = new Map<string, { room: ChatRoom; timestamp: number }>();
  private static userRoomsCache = new Map<string, { rooms: ChatRoom[]; timestamp: number }>();
  private static readonly CACHE_TTL = 30000; // 30 segundos

  /**
   * Generates a unique room code (6-8 alphanumeric characters)
   * @returns Unique room code
   */
  private static generateRoomCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < this.CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Checks if a room exists with the given code
   * @param code - Room code to check
   * @returns True if room exists, false otherwise
   */
  private static async roomExistsByCode(code: string): Promise<boolean> {
    try {
      const snapshot = await firestore
        .collection(this.ROOMS_COLLECTION)
        .where("code", "==", code)
        .limit(1)
        .get();
      return !snapshot.empty;
    } catch (error) {
      return false;
    }
  }

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
   * Creates a new chat room in Firestore
   * @param data - Room creation data (name, type, visibility, participants, etc.)
   * @param createdBy - User ID of the room creator
   * @returns Created chat room with generated code if private
   * @throws Error if room creation fails
   */
  static async createRoom(
    data: CreateRoomData,
    createdBy: string
  ): Promise<ChatRoom> {
    try {
      // Validate required fields
      if (!data.name || !data.type || !data.visibility) {
        throw new Error("Name, type, and visibility are required");
      }

      // Generate unique code for private rooms
      let roomCode: string | undefined;
      if (data.visibility === "private") {
        roomCode = this.generateRoomCode();
        // Ensure code is unique (very rare collision, but better safe)
        let attempts = 0;
        while (await this.roomExistsByCode(roomCode) && attempts < 10) {
          roomCode = this.generateRoomCode();
          attempts++;
        }
        if (attempts >= 10) {
          throw new Error("Failed to generate unique room code");
        }
      }

      const roomId = firestore.collection(this.ROOMS_COLLECTION).doc().id;
      const now = new Date();

      const room: ChatRoom = {
        id: roomId,
        name: data.name,
        description: data.description,
        type: data.type,
        visibility: data.visibility,
        code: roomCode,
        participants: data.participants
          ? [...new Set([createdBy, ...data.participants])]
          : [createdBy],
        createdBy,
        createdAt: now,
        updatedAt: now,
        metadata: data.metadata,
        videoRoomId: typeof data.metadata?.videoRoomId === "string" ? String(data.metadata.videoRoomId) : undefined,
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
   * Gets a chat room by ID with caching (30s TTL)
   * @param roomId - Room ID to retrieve
   * @returns Chat room or null if not found
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
        visibility: data?.visibility || "public",
        code: data?.code,
        participants: data?.participants || [],
        createdBy: data?.createdBy || "",
        createdAt: this.convertToDate(data?.createdAt),
        updatedAt: this.convertToDate(data?.updatedAt),
        metadata: data?.metadata,
        videoRoomId: data?.videoRoomId
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
   * Saves a chat message to Firestore and updates room timestamp
   * @param message - Message to save (id will be generated)
   * @returns Saved message with generated ID
   * @throws Error if message save fails
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
   * Gets messages for a room with pagination support
   * @param roomId - Room ID to get messages from
   * @param limit - Maximum number of messages to return (default: 50)
   * @param lastMessageId - Optional message ID for pagination
   * @returns Array of chat messages in chronological order
   * @throws Error if query fails
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

      return messages.reverse();
    } catch (error) {
      // Fallback: try without orderBy if index is missing
      if (error instanceof Error && error.message.includes("index")) {
        console.warn("Index not found, trying query without orderBy as fallback");
        try {
          const snapshot = await firestore
            .collection(this.MESSAGES_COLLECTION)
            .where("roomId", "==", roomId)
            .limit(limit * 2)
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

          // Sort manually by timestamp and limit
          return messages
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
            .slice(-limit);
        } catch (fallbackError) {
          console.error("Fallback query also failed:", fallbackError);
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
   * - All public rooms (visibility: "public") - visible to everyone
   * - Private rooms (visibility: "private") where user is a participant
   */
  static async getUserRooms(userId: string): Promise<ChatRoom[]> {
    try {
      // Check cache first for public rooms (shared across all users)
      const cached = this.userRoomsCache.get("public");
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        // Still need to fetch private rooms for this user
        const privateRooms = await this.getPrivateRoomsByParticipant(userId);
        const allRooms = [...cached.rooms, ...privateRooms];
        return allRooms.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      }

      const roomsMap = new Map<string, ChatRoom>();

      // Query 1: Get public rooms - visible to everyone
      try {
        const publicRoomsSnapshot = await firestore
          .collection(this.ROOMS_COLLECTION)
          .where("visibility", "==", "public")
          .orderBy("updatedAt", "desc")
          .get();

        publicRoomsSnapshot.forEach((doc) => {
          const data = doc.data();
          const room: ChatRoom = {
            id: doc.id,
            name: data.name || "",
            description: data.description,
            type: data.type || "group",
            visibility: data.visibility || "public",
            code: data.code,
            participants: data.participants || [],
            createdBy: data.createdBy || "",
            createdAt: this.convertToDate(data.createdAt),
            updatedAt: this.convertToDate(data.updatedAt),
            metadata: data.metadata,
            videoRoomId: data.videoRoomId,
          };
          roomsMap.set(doc.id, room);
        });
      } catch (publicError) {
        // Fallback: try without orderBy if index is missing
        if (publicError instanceof Error && publicError.message.includes("index")) {
          console.warn("Index not found for public rooms, trying without orderBy");
          const publicRoomsSnapshot = await firestore
            .collection(this.ROOMS_COLLECTION)
            .where("visibility", "==", "public")
            .get();

          publicRoomsSnapshot.forEach((doc) => {
            const data = doc.data();
            const room: ChatRoom = {
              id: doc.id,
              name: data.name || "",
              description: data.description,
              type: data.type || "group",
              visibility: data.visibility || "public",
              code: data.code,
              participants: data.participants || [],
              createdBy: data.createdBy || "",
              createdAt: this.convertToDate(data.createdAt),
              updatedAt: this.convertToDate(data.updatedAt),
              metadata: data.metadata,
              videoRoomId: data.videoRoomId,
            };
            roomsMap.set(doc.id, room);
          });
        } else {
          console.error("Error fetching public rooms:", publicError);
        }
      }

      // Query 2: Get private rooms where user is a participant
      const privateRooms = await this.getPrivateRoomsByParticipant(userId);
      privateRooms.forEach((room) => {
        roomsMap.set(room.id, room);
      });

      // Convert map to array and sort by updatedAt
      const rooms = Array.from(roomsMap.values());
      const sortedRooms = rooms.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      // Cache public rooms (shared across all users)
      const publicRooms = sortedRooms.filter(r => r.visibility === "public");
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
   * Get private rooms for a user where they are a participant (helper method)
   */
  private static async getPrivateRoomsByParticipant(userId: string): Promise<ChatRoom[]> {
    try {
      const privateRoomsSnapshot = await firestore
        .collection(this.ROOMS_COLLECTION)
        .where("visibility", "==", "private")
        .where("participants", "array-contains", userId)
        .get();

      const rooms: ChatRoom[] = [];
      privateRoomsSnapshot.forEach((doc) => {
        const data = doc.data();
        rooms.push({
          id: doc.id,
          name: data.name || "",
          description: data.description,
          type: data.type || "group",
          visibility: data.visibility || "private",
          code: data.code,
          participants: data.participants || [],
          createdBy: data.createdBy || "",
          createdAt: this.convertToDate(data.createdAt),
          updatedAt: this.convertToDate(data.updatedAt),
          metadata: data.metadata,
          videoRoomId: data.videoRoomId,
        } as ChatRoom);
      });

      return rooms.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    } catch (error) {
      console.error("Error fetching private rooms:", error);
      return [];
    }
  }

  /**
   * Gets a chat room by code
   * @param code - Room code to search for
   * @returns Chat room or null if not found
   */
  static async getRoomByCode(code: string): Promise<ChatRoom | null> {
    try {
      // Validate code format
      if (!this.CODE_REGEX.test(code)) {
        return null;
      }

      const snapshot = await firestore
        .collection(this.ROOMS_COLLECTION)
        .where("code", "==", code.toUpperCase())
        .where("visibility", "==", "private")
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      const room: ChatRoom = {
        id: doc.id,
        name: data?.name || "",
        description: data?.description,
        type: data?.type || "group",
        visibility: data?.visibility || "private",
        code: data?.code,
        participants: data?.participants || [],
        createdBy: data?.createdBy || "",
        createdAt: this.convertToDate(data?.createdAt),
        updatedAt: this.convertToDate(data?.updatedAt),
        metadata: data?.metadata,
        videoRoomId: data?.videoRoomId,
      };

      // Update cache
      this.roomCache.set(room.id, { room, timestamp: Date.now() });

      return room;
    } catch (error) {
      throw new Error(
        `Failed to get room by code: ${error instanceof Error ? error.message : "Unknown error"}`
      );
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


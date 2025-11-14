export interface ChatUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  socketId: string;
  connectedAt: Date;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName?: string;
  senderPicture?: string;
  content: string;
  timestamp: Date;
  type: "text" | "image" | "file" | "system";
  metadata?: Record<string, unknown>;
}

export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  type: "direct" | "group" | "channel";
  participants: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocketUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

export interface JoinRoomData {
  roomId: string;
}

export interface SendMessageData {
  roomId: string;
  content: string;
  type?: "text" | "image" | "file";
  metadata?: Record<string, unknown>;
}

export interface CreateRoomData {
  name: string;
  description?: string;
  type: "direct" | "group" | "channel";
  participants?: string[];
}

export interface ChatError {
  success: false;
  error: string;
  code?: string;
}

export interface ChatSuccess<T = unknown> {
  success: true;
  data: T;
}

export type ChatResponse<T = unknown> = ChatError | ChatSuccess<T>;


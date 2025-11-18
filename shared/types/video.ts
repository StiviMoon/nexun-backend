export interface VideoRoom {
  id: string;
  name: string;
  description?: string;
  hostId: string;
  participants: string[];
  maxParticipants?: number;
  isRecording: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoParticipant {
  userId: string;
  socketId: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  joinedAt: Date;
}

export interface JoinVideoRoomData {
  roomId: string;
}

export interface CreateVideoRoomData {
  name: string;
  description?: string;
  maxParticipants?: number;
}

export interface VideoSignalData {
  type: "offer" | "answer" | "ice-candidate";
  roomId: string;
  targetUserId?: string;
  data: unknown;
}

export interface VideoError {
  success: false;
  error: string;
  code?: string;
}

export interface VideoSuccess<T = unknown> {
  success: true;
  data: T;
}

export type VideoResponse<T = unknown> = VideoError | VideoSuccess<T>;


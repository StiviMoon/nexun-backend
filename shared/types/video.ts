export interface VideoRoom {
  id: string;
  name: string;
  description?: string;
  hostId: string;
  participants: string[];
  maxParticipants?: number;
  isRecording: boolean;
  visibility: "public" | "private";
  code?: string; // Para salas privadas
  chatRoomId?: string; // ID del chat asociado a esta sala de video
  chatRoomCode?: string; // Código del chat asociado (para salas privadas)
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoParticipant {
  userId: string;
  socketId: string;
  userName?: string; // Nombre del usuario (opcional)
  userEmail?: string; // Email del usuario (opcional)
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  joinedAt: Date;
}

export interface JoinVideoRoomData {
  roomId?: string; // ID de la sala
  code?: string; // Código de la sala (alternativa a roomId)
}

export interface CreateVideoRoomData {
  name: string;
  description?: string;
  maxParticipants?: number;
  visibility?: "public" | "private";
  createChat?: boolean; // Si se debe crear un chat asociado
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


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

/**
 * WebRTC Offer/Answer SDP data
 */
export interface RTCSessionDescriptionInit {
  type: "offer" | "answer";
  sdp: string;
}

/**
 * WebRTC ICE Candidate data
 */
export interface RTCIceCandidateInit {
  candidate: string;
  sdpMLineIndex: number | null;
  sdpMid: string | null;
}

/**
 * Union type for all WebRTC signaling data
 */
export type WebRTCSignalData = RTCSessionDescriptionInit | RTCIceCandidateInit;

/**
 * Video signal data for WebRTC peer-to-peer communication
 */
export interface VideoSignalData {
  type: "offer" | "answer" | "ice-candidate";
  roomId: string;
  targetUserId?: string; // If specified, send to specific user; otherwise broadcast to room
  data: WebRTCSignalData;
  metadata?: {
    hasVideo?: boolean;
    hasAudio?: boolean;
    videoEnabled?: boolean;
    audioEnabled?: boolean;
    isScreenSharing?: boolean; // Indica si la señal es para screen sharing
    streamType?: "camera" | "screen"; // Tipo de stream: cámara o pantalla
  };
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


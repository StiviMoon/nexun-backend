/**
 * WebRTC Configuration Utilities
 * 
 * Configuraciones recomendadas para servidores STUN/TURN
 * y constantes para el servicio de video
 */

/**
 * Servidores STUN/TURN recomendados para WebRTC
 * STUN: Para descubrir la IP pública del cliente
 * TURN: Para relaying cuando conexión directa falla (requiere servidor propio)
 */
export const WEBRTC_ICE_SERVERS = [
  // Google STUN servers (gratuitos, públicos)
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  
  // Mozilla STUN server
  { urls: "stun:stun.services.mozilla.com:3478" },
  
  // Nota: Para producción, considera agregar servidores TURN propios
  // Ejemplo:
  // {
  //   urls: "turn:your-turn-server.com:3478",
  //   username: "your-username",
  //   credential: "your-credential"
  // }
];

/**
 * Configuración recomendada para getUserMedia
 */
export const MEDIA_CONSTRAINTS = {
  video: {
    width: { ideal: 1280, min: 640 },
    height: { ideal: 720, min: 480 },
    frameRate: { ideal: 30, min: 15 },
    facingMode: "user" as string
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000
  }
};

/**
 * Configuración para SimplePeer
 */
export const SIMPLE_PEER_CONFIG = {
  trickle: false, // Enviar ICE candidates en batch (más eficiente)
  config: {
    iceServers: WEBRTC_ICE_SERVERS
  },
  // Opciones adicionales para mejor calidad
  sdpTransform: (sdp: string) => {
    // Asegurar que video y audio estén habilitados en SDP
    return sdp
      .replace(/a=fmtp:\d+ .*\r\n/g, '') // Limpiar formatos innecesarios
      .replace(/a=rtcp-fb:\d+ .*\r\n/g, ''); // Limpiar feedback innecesario
  }
};

/**
 * Tipos de señales WebRTC
 */
export enum SignalType {
  OFFER = "offer",
  ANSWER = "answer",
  ICE_CANDIDATE = "ice-candidate"
}

/**
 * Valida si un objeto es una señal WebRTC válida (compatible con PeerJS y WebRTC nativo)
 * PeerJS format:
 * - Offer/Answer: { type: "offer" | "answer", sdp: string }
 * - ICE Candidate: { candidate: string, sdpMLineIndex: number | null, sdpMid: string | null }
 * 
 * También acepta formato alternativo donde el tipo está en el objeto principal
 */
export const isValidSignal = (data: unknown): boolean => {
  if (!data || typeof data !== "object") {
    return false;
  }

  const signal = data as Record<string, unknown>;
  
  // Validar Offer o Answer (formato PeerJS y WebRTC estándar)
  // Puede venir como signal.type o como parte del objeto
  const signalType = signal.type as string;
  if (signalType === "offer" || signalType === "answer") {
    const sdp = signal.sdp;
    return typeof sdp === "string" && sdp.length > 0;
  }
  
  // Validar ICE Candidate (formato PeerJS y WebRTC estándar)
  // Puede venir como signal.type === "ice-candidate" o solo con candidate
  const candidate = signal.candidate;
  if (signalType === "ice-candidate" || candidate) {
    const hasCandidate = typeof candidate === "string" && candidate.length > 0;
    // sdpMLineIndex y sdpMid pueden ser null, undefined, o number/string
    const sdpMLineIndex = signal.sdpMLineIndex;
    const sdpMid = signal.sdpMid;
    const hasValidIndex = sdpMLineIndex === null || sdpMLineIndex === undefined || 
                         typeof sdpMLineIndex === "number";
    const hasValidMid = sdpMid === null || sdpMid === undefined || 
                       typeof sdpMid === "string";
    return hasCandidate && hasValidIndex && hasValidMid;
  }
  
  return false;
};


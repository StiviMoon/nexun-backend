import { Socket } from "socket.io";
import { auth } from "../config/firebase";
import { SocketUser } from "../types/chat";

export interface AuthenticatedSocket extends Socket {
  user?: SocketUser;
}

/**
 * Extended Error interface for Socket.IO middleware
 */
interface ExtendedError extends Error {
  data?: {
    code?: string;
    message?: string;
  };
}

/**
 * Middleware to authenticate Socket.IO connections
 * Expects token in handshake auth or query parameters
 */
export const socketAuthMiddleware = async (
  socket: AuthenticatedSocket,
  next: (err?: ExtendedError) => void
): Promise<void> => {
  try {
    // Try to get token from handshake auth first, then from query
    const token =
      socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token || typeof token !== "string") {
      const error: ExtendedError = new Error("Authentication token required");
      error.data = { code: "AUTH_REQUIRED" };
      next(error);
      return;
    }

    // Verify the token
    const decodedToken = await auth.verifyIdToken(token);

    // Attach user info to socket
    socket.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture
    };

    next();
  } catch (error) {
    const err: ExtendedError = new Error(
      error instanceof Error ? error.message : "Authentication failed"
    );
    err.data = {
      code: "AUTH_FAILED",
      message: error instanceof Error ? error.message : "Invalid token"
    };
    next(err);
  }
};
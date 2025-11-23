import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import * as dotenv from "dotenv";
import { socketAuthMiddleware, AuthenticatedSocket } from "./shared/middleware/socketAuthMiddleware";
import { ChatController } from "./controllers/chatController";
import { Logger } from "./shared/utils/logger";

dotenv.config();

const app = express();
const httpServer = createServer(app);
// Priority: CHAT_SERVICE_PORT > PORT > default (3002)
// This ensures each service uses its specific port when running individually
const PORT = process.env.CHAT_SERVICE_PORT || process.env.PORT || 3002;
// Allow multiple origins or single origin from env
const CORS_ORIGIN = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ["http://localhost:3000", "http://localhost:5000", "http://localhost:5173", "http://localhost:3001"];
const logger = new Logger("chat-service");

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: Array.isArray(CORS_ORIGIN) ? CORS_ORIGIN : [CORS_ORIGIN],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"]
});

// Apply authentication middleware to Socket.IO
io.use(socketAuthMiddleware);

// Initialize Chat Controller
const chatController = new ChatController(io);

// Handle Socket.IO connections
io.on("connection", (socket: AuthenticatedSocket) => {
  chatController.handleConnection(socket);
});

// Middleware
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "chat-service",
    timestamp: new Date().toISOString(),
    onlineUsers: chatController.getOnlineUsersCount()
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Error:", err.message);
  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "Route not found"
  });
});

httpServer.listen(PORT, () => {
  logger.info(`🚀 Chat Service is running on port ${PORT}`);
  logger.info(`📡 CORS enabled for: ${Array.isArray(CORS_ORIGIN) ? CORS_ORIGIN.join(', ') : CORS_ORIGIN}`);
  logger.info(`💬 Chat microservice is active`);
});


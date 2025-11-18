import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import * as dotenv from "dotenv";
import { socketAuthMiddleware, AuthenticatedSocket } from "../../../shared/middleware/socketAuthMiddleware";
import { VideoController } from "./controllers/videoController";
import { Logger } from "../../../shared/utils/logger";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.VIDEO_SERVICE_PORT || 3003;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const logger = new Logger("video-service");

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"]
});

// Apply authentication middleware to Socket.IO
io.use(socketAuthMiddleware);

// Initialize Video Controller
const videoController = new VideoController(io);

// Handle Socket.IO connections
io.on("connection", (socket: AuthenticatedSocket) => {
  videoController.handleConnection(socket);
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
    service: "video-service",
    timestamp: new Date().toISOString()
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
  logger.info(`🚀 Video Service is running on port ${PORT}`);
  logger.info(`📡 CORS enabled for: ${CORS_ORIGIN}`);
  logger.info(`🎥 Video microservice is active`);
});


import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import * as dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import { socketAuthMiddleware, AuthenticatedSocket } from "./middleware/socketAuthMiddleware";
import { ChatController } from "./controllers/chatController";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

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
    message: "Nexun Backend API is running",
    services: {
      chat: "active",
      auth: "active"
    }
  });
});

// API Routes
app.use("/auth", authRoutes);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error:", err);
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
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📡 CORS enabled for: ${CORS_ORIGIN}`);
  console.log(`💬 Chat microservice is active`);
});


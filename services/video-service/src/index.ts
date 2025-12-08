import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import * as dotenv from "dotenv";
import { socketAuthMiddleware, AuthenticatedSocket } from "./shared/middleware/socketAuthMiddleware";
import { VideoController } from "./controllers/videoController";
import { Logger } from "./shared/utils/logger";
import videoRoutes from "./routes/videoRoutes";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const logger = new Logger("video-service");

const PORT = process.env.VIDEO_SERVICE_PORT || process.env.PORT || 3003;
const CORS_ORIGIN = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ["http://localhost:3000", "http://localhost:5000", "http://localhost:5173", "http://localhost:3001"];

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: Array.isArray(CORS_ORIGIN) ? CORS_ORIGIN : [CORS_ORIGIN],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"]
});

io.use(socketAuthMiddleware);

io.on("connection_error", (err) => {
  logger.error(`Socket connection error: ${err.message || "Unknown error"}`);
});

const videoController = new VideoController(io);
io.on("connection", (socket: AuthenticatedSocket) => {
  videoController.handleConnection(socket);
  
  // Handle socket errors to prevent empty error objects
  socket.on("error", (error: unknown) => {
    logger.error(`Socket error: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
  });
});

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/video", videoRoutes);

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "video-service",
    timestamp: new Date().toISOString()
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Error:", err.message);
  res.status(500).json({ success: false, error: "Internal server error" });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

httpServer.listen(PORT, () => {
  logger.info(`🚀 Video Service running on port ${PORT}`);
  logger.info(`📡 CORS: ${Array.isArray(CORS_ORIGIN) ? CORS_ORIGIN.join(', ') : CORS_ORIGIN}`);
});


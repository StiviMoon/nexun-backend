import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import { Logger } from "../../../shared/utils/logger";

dotenv.config();

const app = express();
// Priority: AUTH_SERVICE_PORT > PORT > default (3001)
// This ensures each service uses its specific port when running individually
const PORT = process.env.AUTH_SERVICE_PORT || process.env.PORT || 3001;
// Allow multiple origins or single origin from env
const CORS_ORIGIN = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ["http://localhost:3000", "http://localhost:5000", "http://localhost:5173", "http://localhost:3001"];
const logger = new Logger("auth-service");

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
    service: "auth-service",
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use("/auth", authRoutes);

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

app.listen(PORT, () => {
  logger.info(`🚀 Auth Service is running on port ${PORT}`);
  logger.info(`📡 CORS enabled for: ${Array.isArray(CORS_ORIGIN) ? CORS_ORIGIN.join(', ') : CORS_ORIGIN}`);
});


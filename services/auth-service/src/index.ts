import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import { Logger } from "../../../shared/utils/logger";

dotenv.config();

const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
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
  logger.info(`📡 CORS enabled for: ${CORS_ORIGIN}`);
});


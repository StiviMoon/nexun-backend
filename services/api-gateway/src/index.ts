import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cors from "cors";
import { createProxyMiddleware, Options } from "http-proxy-middleware";
import swaggerUi from "swagger-ui-express";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { Logger } from "../../../shared/utils/logger";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.GATEWAY_PORT || 3000;
// Allow multiple origins or single origin from env
const CORS_ORIGIN = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ["http://localhost:3000", "http://localhost:5000", "http://localhost:5173", "http://localhost:3001"];
const logger = new Logger("api-gateway");

// Service URLs
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:3001";
const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || "http://localhost:3002";
const VIDEO_SERVICE_URL = process.env.VIDEO_SERVICE_URL || "http://localhost:3003";

// Middleware
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true
  })
);

// Health check endpoint (antes del body parser para evitar problemas)
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "api-gateway",
    timestamp: new Date().toISOString(),
    services: {
      auth: AUTH_SERVICE_URL,
      chat: CHAT_SERVICE_URL,
      video: VIDEO_SERVICE_URL
    }
  });
});

// Swagger Documentation Routes
const swaggerOptions = {
  customCss: ".swagger-ui .topbar { display: none }",
  customSiteTitle: "Nexun API Documentation"
};

// Load Swagger specs
const loadSwaggerSpec = (filePath: string) => {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const fileContent = fs.readFileSync(fullPath, "utf-8");
    return JSON.parse(fileContent);
  } catch (error) {
    logger.error(`Error loading Swagger spec from ${filePath}:`, error);
    return null;
  }
};

// API Gateway Swagger
const gatewaySpec = loadSwaggerSpec("services/api-gateway/swagger.json");
if (gatewaySpec) {
  app.use("/api-docs/gateway", swaggerUi.serve, swaggerUi.setup(gatewaySpec, swaggerOptions));
}

// Auth Service Swagger
const authSpec = loadSwaggerSpec("services/auth-service/swagger.json");
if (authSpec) {
  app.use("/api-docs/auth", swaggerUi.serve, swaggerUi.setup(authSpec, swaggerOptions));
}

// Chat Service Swagger
const chatSpec = loadSwaggerSpec("services/chat-service/swagger.json");
if (chatSpec) {
  app.use("/api-docs/chat", swaggerUi.serve, swaggerUi.setup(chatSpec, swaggerOptions));
}

// Video Service Swagger
const videoSpec = loadSwaggerSpec("services/video-service/swagger.json");
if (videoSpec) {
  app.use("/api-docs/video", swaggerUi.serve, swaggerUi.setup(videoSpec, swaggerOptions));
}

// Documentation index page
app.get("/api-docs", (_req: Request, res: Response) => {
  // Handle both development (src/) and production (dist/) paths
  const isProduction = __dirname.includes("dist");
  const viewsDir = isProduction 
    ? path.join(__dirname, "views")
    : path.join(process.cwd(), "services", "api-gateway", "src", "views");
  const docsPath = path.join(viewsDir, "docs.html");
  
  // Check if file exists, fallback to src if not found in dist
  if (!fs.existsSync(docsPath) && isProduction) {
    const fallbackPath = path.join(process.cwd(), "services", "api-gateway", "src", "views", "docs.html");
    if (fs.existsSync(fallbackPath)) {
      return res.sendFile(fallbackPath);
    }
  }
  
  res.sendFile(docsPath);
});

// Proxy to Auth Service (ANTES del body parser)
app.use(
  "/api/auth",
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/api/auth": "/auth"
    },
    secure: false,
    ws: false,
    onProxyReq: (_proxyReq: unknown, req: Request) => {
      logger.info(`Proxying ${req.method} ${req.url} to auth-service`);
    },
    onError: (err: Error, _req: Request, res: Response) => {
      logger.error(`Error proxying to auth-service: ${err.message}`);
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: "Auth service unavailable",
          details: err.message
        });
      }
    },
    onProxyRes: (proxyRes) => {
      logger.info(`Response from auth-service: ${proxyRes.statusCode}`);
    }
  } as Options)
);

// Body parser solo para rutas que no son proxy
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Proxy to Chat Service (REST endpoints and WebSocket)
const chatProxy = createProxyMiddleware({
  target: CHAT_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    "^/api/chat": ""
  },
  secure: false,
  ws: true, // Enable WebSocket support for Socket.IO
  logLevel: "info",
  onProxyReq: (_proxyReq: unknown, req: Request) => {
    logger.info(`Proxying ${req.method} ${req.url} to chat-service`);
  },
  onError: (err: Error, _req: Request, res: Response) => {
    logger.error(`Error proxying to chat-service: ${err.message}`);
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        error: "Chat service unavailable"
      });
    }
  }
} as Options);

app.use("/api/chat", chatProxy);

// Proxy to Video Service (REST endpoints and WebSocket)
const videoProxy = createProxyMiddleware({
  target: VIDEO_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    "^/api/video": ""
  },
  secure: false,
  ws: true, // Enable WebSocket support for Socket.IO
  logLevel: "info",
  onProxyReq: (_proxyReq: unknown, req: Request) => {
    logger.info(`Proxying ${req.method} ${req.url} to video-service`);
  },
  onError: (err: Error, _req: Request, res: Response) => {
    logger.error(`Error proxying to video-service: ${err.message}`);
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        error: "Video service unavailable"
      });
    }
  }
} as Options);

app.use("/api/video", videoProxy);

// WebSocket upgrade handler - route to appropriate service
httpServer.on("upgrade", (req, socket, head) => {
  const url = req.url || "";
  
  // Route chat WebSocket connections
  if (url.includes("/api/chat") || (url.startsWith("/socket.io") && req.headers.referer?.includes("/api/chat"))) {
    logger.info(`WebSocket upgrade request for chat: ${url}`);
    // @ts-ignore - http-proxy-middleware types
    chatProxy.upgrade(req, socket, head);
  }
  // Route video WebSocket connections
  else if (url.includes("/api/video") || (url.startsWith("/socket.io") && req.headers.referer?.includes("/api/video"))) {
    logger.info(`WebSocket upgrade request for video: ${url}`);
    // @ts-ignore - http-proxy-middleware types
    videoProxy.upgrade(req, socket, head);
  }
  // Default: try chat service (Socket.IO default path)
  else if (url.startsWith("/socket.io")) {
    logger.info(`WebSocket upgrade request (default to chat): ${url}`);
    // @ts-ignore - http-proxy-middleware types
    chatProxy.upgrade(req, socket, head);
  }
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
  logger.info(`🚀 API Gateway is running on port ${PORT}`);
  logger.info(`📡 CORS enabled for: ${Array.isArray(CORS_ORIGIN) ? CORS_ORIGIN.join(', ') : CORS_ORIGIN}`);
  logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  logger.info(`🔌 WebSocket support enabled for Socket.IO`);
  logger.info(`🔀 Proxying requests to:`);
  logger.info(`   - Auth Service: ${AUTH_SERVICE_URL}`);
  logger.info(`   - Chat Service: ${CHAT_SERVICE_URL} (WebSocket: ${CHAT_SERVICE_URL.replace("http", "ws")})`);
  logger.info(`   - Video Service: ${VIDEO_SERVICE_URL} (WebSocket: ${VIDEO_SERVICE_URL.replace("http", "ws")})`);
});


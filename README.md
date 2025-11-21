# Nexun Backend - Microservices Architecture

Real-time video conferencing and chat backend built with a clean, scalable microservices architecture.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project configured

### Installation

```bash
npm install
```

### Configuration

Create a `.env` file in the root directory:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key

# CORS (comma-separated for multiple origins)
# Default includes: http://localhost:3000, http://localhost:5000, http://localhost:5173, http://localhost:3001
CORS_ORIGIN=http://localhost:3000,http://localhost:5000,http://localhost:5173

# Service Ports
GATEWAY_PORT=3000
AUTH_SERVICE_PORT=3001
CHAT_SERVICE_PORT=3002
VIDEO_SERVICE_PORT=3003

# Service URLs
AUTH_SERVICE_URL=http://localhost:3001
CHAT_SERVICE_URL=http://localhost:3002
VIDEO_SERVICE_URL=http://localhost:3003
```

### Running

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm run start
```

## 📁 Project Structure

```
nexun-backend/
├── shared/                    # Shared code
│   ├── config/               # Firebase configuration
│   ├── types/                # TypeScript types
│   ├── middleware/           # Shared middleware
│   └── utils/                # Utilities
│
├── services/
│   ├── api-gateway/          # API Gateway (port 3000)
│   ├── auth-service/         # Authentication (port 3001)
│   ├── chat-service/         # Real-time chat (port 3002)
│   └── video-service/        # Video conferencing (port 3003)
│
└── package.json
```

## 🔌 Services

### API Gateway (Port 3000)
- Entry point for all client requests
- Routes requests to appropriate microservices
- **Swagger**: `services/api-gateway/swagger.json`

### Auth Service (Port 3001)
- User registration and authentication
- Google OAuth support
- Token verification
- **Swagger**: `services/auth-service/swagger.json`
- **Endpoints**: `/api/auth/*`

### Chat Service (Port 3002)
- Real-time chat with Socket.IO
- Room management
- Message history
- **Swagger**: `services/chat-service/swagger.json`
- **WebSocket**: `ws://localhost:3002`

### Video Service (Port 3003)
- Video conferencing with WebRTC
- Screen sharing
- Audio/Video controls
- **Swagger**: `services/video-service/swagger.json`
- **WebSocket**: `ws://localhost:3003`

## 📚 Documentation

### Frontend Integration

**Complete guide for frontend developers**: See [`FRONTEND_INTEGRATION.md`](./FRONTEND_INTEGRATION.md)

**Google Authentication example**: See [`GOOGLE_AUTH_EXAMPLE.md`](./GOOGLE_AUTH_EXAMPLE.md)

These guides include:
- Authentication setup (Firebase Auth)
- Google OAuth step-by-step implementation
- REST API usage examples
- WebSocket/Socket.IO connection guides
- Complete React examples
- Best practices and error handling

### API Documentation (Swagger)

**View all API docs in your browser:**

1. Start the API Gateway: `npm run dev:gateway`
2. Visit: **http://localhost:3000/api-docs**

This provides interactive Swagger UI for all services:
- **API Gateway**: http://localhost:3000/api-docs/gateway
- **Auth Service**: http://localhost:3000/api-docs/auth
- **Chat Service**: http://localhost:3000/api-docs/chat
- **Video Service**: http://localhost:3000/api-docs/video

**Swagger JSON files:**
- `services/auth-service/swagger.json`
- `services/chat-service/swagger.json`
- `services/video-service/swagger.json`
- `services/api-gateway/swagger.json`

### Code Documentation (JSDoc)

All services use JSDoc for inline documentation. Key functions include:
- Parameter descriptions
- Return types
- Error handling
- Usage examples

See `DOCUMENTATION.md` for more details.

## 🧪 Testing

### Postman Collection

Import `postman_collection.json` into Postman for quick API testing.

### Health Checks

```bash
# Gateway
curl http://localhost:3000/health

# Auth Service
curl http://localhost:3001/health

# Chat Service
curl http://localhost:3002/health

# Video Service
curl http://localhost:3003/health
```

## 📝 Available Scripts

- `npm run dev` - Run all services in development mode
- `npm run dev:gateway` - Run only API Gateway
- `npm run dev:auth` - Run only Auth Service
- `npm run dev:chat` - Run only Chat Service
- `npm run dev:video` - Run only Video Service
- `npm run build` - Build all services
- `npm run start` - Run all services in production mode
- `npm run lint` - Lint all TypeScript files

## 🔐 Authentication

All services use Firebase Auth for authentication:

- **REST API**: Include `Authorization: Bearer <token>` header
- **WebSocket**: Pass token in connection: `auth: { token: '<token>' }`

## 📖 Additional Documentation

- **Architecture Details**: See `ARCHITECTURE.md`
- **API Testing**: See `POSTMAN_GUIDE.md`

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-time**: Socket.IO
- **Database**: Firebase Firestore
- **Authentication**: Firebase Admin SDK
- **Language**: TypeScript
- **Validation**: Zod

## 📄 License

MIT

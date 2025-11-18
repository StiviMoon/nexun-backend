# 📚 Documentation Guide

## API Documentation (Swagger/OpenAPI)

Each microservice includes a Swagger/OpenAPI specification file:

### Auth Service
- **File**: `services/auth-service/swagger.json`
- **View**: Import into Swagger UI or Postman
- **Endpoints**: All REST endpoints documented with request/response schemas

### Chat Service
- **File**: `services/chat-service/swagger.json`
- **View**: Import into Swagger UI or Postman
- **Includes**: Socket.IO events documentation

### Video Service
- **File**: `services/video-service/swagger.json`
- **View**: Import into Swagger UI or Postman
- **Includes**: Socket.IO events and WebRTC signaling documentation

### API Gateway
- **File**: `services/api-gateway/swagger.json`
- **View**: Import into Swagger UI or Postman
- **Includes**: Proxy routes and health checks

## Code Documentation (JSDoc)

All services use JSDoc for inline code documentation:

### Format
```typescript
/**
 * Brief description of the function
 * @param paramName - Parameter description
 * @returns Return value description
 * @throws Error description
 */
```

### Examples

**Service Methods:**
```typescript
/**
 * Creates a new user account in Firebase Auth and saves profile to Firestore
 * @param email - User email address
 * @param password - User password (min 6 characters)
 * @param displayName - Optional display name for the user
 * @returns Object containing custom token and user profile
 * @throws Error with Firebase error codes
 */
```

**Route Handlers:**
```typescript
/**
 * @route POST /auth/register
 * @desc Register a new user account
 * @access Public
 */
```

## Viewing Documentation

### Swagger UI (Recommended)

The easiest way to view all API documentation is through the API Gateway:

1. **Start the API Gateway:**
```bash
npm run dev:gateway
```

2. **Open in your browser:**
   - **Main Documentation Hub**: http://localhost:3000/api-docs
   - **API Gateway Docs**: http://localhost:3000/api-docs/gateway
   - **Auth Service Docs**: http://localhost:3000/api-docs/auth
   - **Chat Service Docs**: http://localhost:3000/api-docs/chat
   - **Video Service Docs**: http://localhost:3000/api-docs/video

The main hub (`/api-docs`) provides a beautiful interface to navigate between all services.

### Alternative: Swagger Editor (Online)

1. Go to https://editor.swagger.io/
2. Click "File" → "Import file"
3. Select any `swagger.json` file from the services

### Postman

1. Import `postman_collection.json` for quick testing
2. Import individual `swagger.json` files for detailed API docs

### IDE Support

Most IDEs (VS Code, WebStorm) automatically show JSDoc when hovering over functions.

## Documentation Standards

### What to Document

✅ **Document:**
- Public API methods
- Route handlers
- Complex business logic
- Error conditions
- Parameters and return types

❌ **Don't Document:**
- Obvious getters/setters
- Self-explanatory code
- Private helper methods (unless complex)

### Language

- All documentation in **English**
- Use clear, concise descriptions
- Include examples for complex APIs
- Document error cases


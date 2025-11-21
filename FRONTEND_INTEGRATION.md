# 🎨 Frontend Integration Guide

Complete guide for integrating your frontend application with the Nexun microservices backend.

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication](#authentication)
3. [REST API Usage](#rest-api-usage)
4. [WebSocket Connections](#websocket-connections)
5. [Complete Examples](#complete-examples)
6. [Best Practices](#best-practices)

---

## 🏗️ Architecture Overview

Your frontend should connect to the **API Gateway** (port 3000), which routes requests to the appropriate microservices:

```
Frontend → API Gateway (3000) → Auth Service (3001)
                              → Chat Service (3002)
                              → Video Service (3003)
```

**Base URL**: `http://localhost:3000` (or your production URL)

---

## 🔐 Authentication

All requests require Firebase Authentication. Your frontend needs to:

1. Authenticate users with Firebase Auth
2. Get the ID token
3. Include it in requests

### Setup Firebase in Frontend

```javascript
// Install: npm install firebase

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  // ... other config
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
```

### Get ID Token

```javascript
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;

// Get ID token (refresh if needed)
const getIdToken = async () => {
  if (user) {
    return await user.getIdToken(true); // true = force refresh
  }
  throw new Error('User not authenticated');
};
```

---

## 🌐 REST API Usage

### Base Configuration

```javascript
const API_BASE_URL = 'http://localhost:3000';

// Helper function to make authenticated requests
const apiRequest = async (endpoint, options = {}) => {
  const token = await getIdToken();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
};
```

### Auth Service Endpoints

#### Register User
```javascript
import { signInWithCustomToken } from 'firebase/auth';

const register = async (email, password, name) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  
  const data = await response.json();
  
  if (data.success && data.token) {
    // Sign in with Firebase using the custom token
    const userCredential = await signInWithCustomToken(auth, data.token);
    return {
      user: userCredential.user,
      profile: data.user
    };
  }
  
  throw new Error(data.error || 'Registration failed');
};
```

#### Login
```javascript
import { signInWithEmailAndPassword } from 'firebase/auth';

const login = async (email, password) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  
  const data = await response.json();
  
  if (data.success && data.token) {
    // Sign in with Firebase using the custom token
    const userCredential = await signInWithCustomToken(auth, data.token);
    return {
      user: userCredential.user,
      profile: data.user
    };
  }
  
  throw new Error(data.error || 'Login failed');
};
```

#### Google OAuth
```javascript
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const userCredential = await signInWithPopup(auth, provider);
  const idToken = await userCredential.user.getIdToken();
  
  const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken }),
  });
  
  const data = await response.json();
  
  if (data.success) {
    return {
      user: userCredential.user,
      profile: data.user
    };
  }
  
  throw new Error(data.error || 'Google login failed');
};
```

#### Get Current User
```javascript
const getCurrentUser = async () => {
  return apiRequest('/api/auth/me');
};
```

#### Verify Token
```javascript
const verifyToken = async () => {
  const token = await getIdToken();
  const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return response.json();
};
```

---

## 💬 WebSocket Connections (Chat & Video)

### Socket.IO Setup

```javascript
// Install: npm install socket.io-client

import { io } from 'socket.io-client';

const API_BASE_URL = 'http://localhost:3000';
```

### Chat Service Connection

**Important**: You have two options for connecting:

1. **Direct connection** (simpler, recommended for development):
   ```javascript
   const socket = io('http://localhost:3002', {
     auth: { token: 'YOUR_TOKEN' }
   });
   ```

2. **Through API Gateway** (better for production):
   ```javascript
   const socket = io('http://localhost:3000', {
     path: '/socket.io',
     auth: { token: 'YOUR_TOKEN' }
   });
   ```

**Full ChatService class:**

```javascript
class ChatService {
  constructor(useGateway = false) {
    this.socket = null;
    this.baseUrl = useGateway 
      ? API_BASE_URL  // Through gateway
      : 'http://localhost:3002';  // Direct to service
  }
  
  async connect() {
    const token = await getIdToken();
    
    this.socket = io(this.baseUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: {
        token: token
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
    
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Connected to chat service');
    });
    
    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from chat service');
    });
    
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    // Listen for token expiration
    this.socket.on('auth:error', async () => {
      // Refresh token and reconnect
      const newToken = await getIdToken(true);
      this.socket.auth.token = newToken;
      this.socket.connect();
    });
    
    return this.socket;
  }
  
  // Join a room
  joinRoom(roomId) {
    this.socket.emit('chat:room:join', { roomId });
  }
  
  // Leave a room
  leaveRoom(roomId) {
    this.socket.emit('chat:room:leave', { roomId });
  }
  
  // Send a message
  sendMessage(roomId, content, type = 'text') {
    this.socket.emit('chat:message:send', {
      roomId,
      content,
      type,
    });
  }
  
  // Create a room
  createRoom(name, type, participants = []) {
    this.socket.emit('chat:room:create', {
      name,
      type,
      participants,
    });
  }
  
  // Get room info
  getRoom(roomId) {
    this.socket.emit('chat:room:get', { roomId });
  }
  
  // Get messages
  getMessages(roomId, limit = 50, startAfter = null) {
    this.socket.emit('chat:messages:get', {
      roomId,
      limit,
      startAfter,
    });
  }
  
  // Listen for new messages
  onMessage(callback) {
    this.socket.on('chat:message:new', callback);
  }
  
  // Listen for room updates
  onRoomJoined(callback) {
    this.socket.on('chat:room:joined', callback);
  }
  
  // Listen for user status
  onUserOnline(callback) {
    this.socket.on('user:online', callback);
  }
  
  onUserOffline(callback) {
    this.socket.on('user:offline', callback);
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Usage
// Option 1: Direct connection (simpler)
const chatService = new ChatService(false);
await chatService.connect();

// Option 2: Through API Gateway (production)
const chatService = new ChatService(true);
await chatService.connect();

// Join a room
chatService.joinRoom('room-123');

// Listen for messages
chatService.onMessage((message) => {
  console.log('New message:', message);
  // Update your UI
});

// Send a message
chatService.sendMessage('room-123', 'Hello, world!');
```

### Video Service Connection

```javascript
class VideoService {
  constructor(useGateway = false) {
    this.socket = null;
    this.baseUrl = useGateway 
      ? API_BASE_URL  // Through gateway
      : 'http://localhost:3003';  // Direct to service
  }
  
  async connect() {
    const token = await getIdToken();
    
    this.socket = io(this.baseUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
    });
    
    this.socket.on('connect', () => {
      console.log('✅ Connected to video service');
    });
    
    return this.socket;
  }
  
  // Create a video room
  createRoom(name, description, maxParticipants = 50) {
    this.socket.emit('video:room:create', {
      name,
      description,
      maxParticipants,
    });
  }
  
  // Join a video room
  joinRoom(roomId) {
    this.socket.emit('video:room:join', { roomId });
  }
  
  // Leave a video room
  leaveRoom(roomId) {
    this.socket.emit('video:room:leave', { roomId });
  }
  
  // WebRTC signaling events
  onOffer(callback) {
    this.socket.on('video:offer', callback);
  }
  
  onAnswer(callback) {
    this.socket.on('video:answer', callback);
  }
  
  onIceCandidate(callback) {
    this.socket.on('video:ice-candidate', callback);
  }
  
  // Send WebRTC offer
  sendOffer(roomId, offer) {
    this.socket.emit('video:offer', { roomId, offer });
  }
  
  // Send WebRTC answer
  sendAnswer(roomId, answer) {
    this.socket.emit('video:answer', { roomId, answer });
  }
  
  // Send ICE candidate
  sendIceCandidate(roomId, candidate) {
    this.socket.emit('video:ice-candidate', { roomId, candidate });
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Usage
const videoService = new VideoService();
await videoService.connect();

videoService.joinRoom('video-room-123');
```

---

## 📦 Complete React Example

```jsx
// hooks/useAuth.js
import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    
    return unsubscribe;
  }, []);
  
  return { user, loading };
};

// hooks/useChat.js
import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { getAuth } from 'firebase/auth';

export const useChat = () => {
  const [messages, setMessages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const socketRef = useRef(null);
  
  useEffect(() => {
    const connect = async () => {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      
      socketRef.current = io('http://localhost:3000', {
        path: '/socket.io',
        auth: { token },
      });
      
      socketRef.current.on('chat:message:new', (message) => {
        setMessages(prev => [...prev, message]);
      });
      
      socketRef.current.on('chat:room:joined', (data) => {
        setRooms(prev => [...prev, data.room]);
      });
    };
    
    connect();
    
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);
  
  const sendMessage = (roomId, content) => {
    socketRef.current?.emit('chat:message:send', { roomId, content });
  };
  
  const joinRoom = (roomId) => {
    socketRef.current?.emit('chat:room:join', { roomId });
  };
  
  return { messages, rooms, sendMessage, joinRoom };
};

// components/ChatRoom.jsx
import { useChat } from '../hooks/useChat';

export const ChatRoom = ({ roomId }) => {
  const { messages, sendMessage } = useChat();
  const [input, setInput] = useState('');
  
  useEffect(() => {
    joinRoom(roomId);
  }, [roomId]);
  
  const handleSend = () => {
    if (input.trim()) {
      sendMessage(roomId, input);
      setInput('');
    }
  };
  
  return (
    <div>
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id}>{msg.content}</div>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
      />
      <button onClick={handleSend}>Send</button>
    </div>
  );
};
```

---

## 🎯 Best Practices

### 1. Token Management

```javascript
// Create a token refresh interceptor
let tokenRefreshPromise = null;

const refreshTokenIfNeeded = async () => {
  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }
  
  tokenRefreshPromise = (async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken(true);
      tokenRefreshPromise = null;
      return token;
    }
    throw new Error('Not authenticated');
  })();
  
  return tokenRefreshPromise;
};
```

### 2. Error Handling

```javascript
const handleApiError = (error) => {
  if (error.response?.status === 401) {
    // Token expired, refresh and retry
    return refreshTokenIfNeeded().then(() => {
      // Retry original request
    });
  }
  
  if (error.response?.status === 503) {
    // Service unavailable
    console.error('Service temporarily unavailable');
  }
  
  throw error;
};
```

### 3. Connection Management

```javascript
// Reconnect on token refresh
const setupSocketReconnection = (socket) => {
  socket.on('auth:error', async () => {
    const newToken = await getIdToken(true);
    socket.auth.token = newToken;
    socket.connect();
  });
};
```

### 4. Environment Variables

```javascript
// .env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...

// config.js
export const config = {
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  firebase: {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    // ...
  },
};
```

### 5. TypeScript Types (Optional)

```typescript
// types/api.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  type: 'text' | 'image' | 'file';
  timestamp: Date;
}

export interface ChatRoom {
  id: string;
  name: string;
  type: 'private' | 'group';
  participants: string[];
  createdAt: Date;
}
```

---

## 🔗 Quick Reference

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/google` | Google OAuth |
| POST | `/api/auth/verify` | Verify token |
| GET | `/api/auth/me` | Get current user |
| GET | `/health` | Health check |

### Socket.IO Events (Chat)

| Event | Direction | Description |
|-------|-----------|-------------|
| `chat:room:join` | Client → Server | Join a room |
| `chat:room:leave` | Client → Server | Leave a room |
| `chat:message:send` | Client → Server | Send message |
| `chat:room:create` | Client → Server | Create room |
| `chat:message:new` | Server → Client | New message received |
| `chat:room:joined` | Server → Client | Successfully joined room |
| `user:online` | Server → Client | User came online |
| `user:offline` | Server → Client | User went offline |

---

## 🚀 Getting Started Checklist

- [ ] Install dependencies: `firebase`, `socket.io-client`
- [ ] Configure Firebase in your frontend
- [ ] Set up API base URL
- [ ] Implement authentication flow
- [ ] Create API service wrapper
- [ ] Set up Socket.IO connections
- [ ] Handle token refresh
- [ ] Add error handling
- [ ] Test all endpoints
- [ ] Test WebSocket connections

---

## 📚 Additional Resources

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Socket.IO Client Documentation](https://socket.io/docs/v4/client-api/)
- [API Documentation](http://localhost:3000/api-docs) (when gateway is running)


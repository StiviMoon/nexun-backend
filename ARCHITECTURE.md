# Arquitectura de Microservicios - Nexun Backend

## 📋 Visión General

Este proyecto utiliza una arquitectura de microservicios para separar las responsabilidades del sistema en servicios independientes y escalables. Cada microservicio maneja un dominio específico de la aplicación.

## 🏗️ Estructura de Microservicios

### 1. **API Gateway** (Puerto 3000)
- **Propósito**: Punto de entrada único para todas las peticiones del cliente
- **Responsabilidades**:
  - Enrutamiento de peticiones a los microservicios correspondientes
  - Balanceo de carga (futuro)
  - Autenticación centralizada (futuro)
  - Rate limiting (futuro)
- **Tecnologías**: Express.js, http-proxy-middleware

### 2. **Auth Service** (Puerto 3001)
- **Propósito**: Gestión de autenticación y autorización
- **Responsabilidades**:
  - Registro de usuarios
  - Inicio de sesión
  - Verificación de tokens
  - Gestión de perfiles de usuario
  - Autenticación con Google
- **Tecnologías**: Express.js, Firebase Admin SDK
- **Endpoints**:
  - `POST /auth/register` - Registrar nuevo usuario
  - `POST /auth/login` - Iniciar sesión
  - `POST /auth/google` - Autenticación con Google
  - `POST /auth/verify` - Verificar token
  - `GET /auth/me` - Obtener perfil del usuario actual
  - `POST /auth/logout` - Cerrar sesión

### 3. **Chat Service** (Puerto 3002)
- **Propósito**: Sistema de chat en tiempo real
- **Responsabilidades**:
  - Gestión de salas de chat
  - Envío y recepción de mensajes en tiempo real
  - Gestión de participantes
  - Notificaciones de estado (online/offline)
- **Tecnologías**: Express.js, Socket.IO, Firebase Firestore
- **Eventos Socket.IO**:
  - `room:join` - Unirse a una sala
  - `room:leave` - Salir de una sala
  - `room:create` - Crear una sala
  - `room:get` - Obtener detalles de una sala
  - `message:send` - Enviar mensaje
  - `messages:get` - Obtener mensajes
  - `user:online` - Usuario conectado
  - `user:offline` - Usuario desconectado

### 4. **Video Service** (Puerto 3003)
- **Propósito**: Sistema de videollamadas en tiempo real
- **Responsabilidades**:
  - Gestión de salas de videollamada
  - Señalización WebRTC (offer, answer, ICE candidates)
  - Control de audio/video (mute, unmute, encender/apagar cámara)
  - Compartir pantalla
  - Gestión de participantes
- **Tecnologías**: Express.js, Socket.IO, Firebase Firestore, WebRTC
- **Eventos Socket.IO**:
  - `video:room:create` - Crear sala de videollamada
  - `video:room:join` - Unirse a sala de videollamada
  - `video:room:leave` - Salir de sala de videollamada
  - `video:room:end` - Finalizar sala (solo host)
  - `video:signal` - Señalización WebRTC
  - `video:toggle-audio` - Activar/desactivar audio
  - `video:toggle-video` - Activar/desactivar video
  - `video:toggle-screen` - Activar/desactivar compartir pantalla

## 📁 Estructura de Directorios

```
nexun-backend/
├── shared/                    # Código compartido entre microservicios
│   ├── config/
│   │   └── firebase.ts       # Configuración de Firebase
│   ├── types/                # Tipos TypeScript compartidos
│   │   ├── auth.ts
│   │   ├── chat.ts
│   │   └── video.ts
│   ├── middleware/           # Middleware compartido
│   │   ├── authMiddleware.ts
│   │   └── socketAuthMiddleware.ts
│   └── utils/
│       └── logger.ts          # Utilidad de logging
│
├── services/
│   ├── api-gateway/          # API Gateway
│   │   └── src/
│   │       └── index.ts
│   │
│   ├── auth-service/         # Servicio de Autenticación
│   │   └── src/
│   │       ├── index.ts
│   │       ├── routes/
│   │       │   └── authRoutes.ts
│   │       └── services/
│   │           └── authService.ts
│   │
│   ├── chat-service/         # Servicio de Chat
│   │   └── src/
│   │       ├── index.ts
│   │       ├── controllers/
│   │       │   └── chatController.ts
│   │       └── services/
│   │           └── chatService.ts
│   │
│   └── video-service/        # Servicio de Videollamadas
│       └── src/
│           ├── index.ts
│           ├── controllers/
│           │   └── videoController.ts
│           └── services/
│               └── videoService.ts
│
└── package.json
```

## 🔧 Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key

# CORS
CORS_ORIGIN=http://localhost:3000

# Service Ports
GATEWAY_PORT=3000
AUTH_SERVICE_PORT=3001
CHAT_SERVICE_PORT=3002
VIDEO_SERVICE_PORT=3003

# Service URLs (para desarrollo local)
AUTH_SERVICE_URL=http://localhost:3001
CHAT_SERVICE_URL=http://localhost:3002
VIDEO_SERVICE_URL=http://localhost:3003

# Logging
LOG_LEVEL=INFO
```

## 🚀 Ejecución

### Desarrollo

Para ejecutar todos los microservicios en modo desarrollo:

```bash
npm run dev
```

Para ejecutar un microservicio específico:

```bash
npm run dev:gateway    # API Gateway
npm run dev:auth       # Auth Service
npm run dev:chat       # Chat Service
npm run dev:video      # Video Service
```

### Producción

1. Compilar todos los servicios:
```bash
npm run build
```

2. Ejecutar todos los servicios:
```bash
npm run start
```

O ejecutar servicios individuales:
```bash
npm run start:gateway
npm run start:auth
npm run start:chat
npm run start:video
```

## 🔌 Conexión desde el Cliente

### REST API (a través del Gateway)

Todas las peticiones REST deben ir al API Gateway:

```
http://localhost:3000/api/auth/*     -> Auth Service
http://localhost:3000/api/chat/*     -> Chat Service
http://localhost:3000/api/video/*    -> Video Service
```

### WebSocket (conexión directa)

Para Socket.IO, el cliente debe conectarse directamente a cada servicio:

```typescript
// Chat Service
const chatSocket = io('http://localhost:3002', {
  auth: { token: userToken }
});

// Video Service
const videoSocket = io('http://localhost:3003', {
  auth: { token: userToken }
});
```

**Nota**: En producción, considera usar un reverse proxy (nginx) para manejar WebSockets a través del mismo dominio.

## 🏛️ Principios de Arquitectura

### 1. **Separación de Responsabilidades**
Cada microservicio tiene una responsabilidad única y bien definida.

### 2. **Código Compartido**
El código común (configuración, tipos, middleware) se encuentra en `shared/` para evitar duplicación.

### 3. **Independencia**
Cada microservicio puede:
- Desplegarse independientemente
- Escalarse independientemente
- Fallar sin afectar otros servicios

### 4. **Comunicación**
- **REST**: Para operaciones CRUD y peticiones síncronas
- **WebSocket**: Para comunicación en tiempo real (chat, video)

### 5. **Base de Datos Compartida**
Actualmente todos los servicios comparten Firebase Firestore. En el futuro, considera separar las bases de datos por servicio.

## 🔐 Autenticación

Todos los servicios utilizan Firebase Auth para autenticación:

1. El cliente obtiene un token ID de Firebase
2. El token se envía en:
   - **REST**: Header `Authorization: Bearer <token>`
   - **WebSocket**: `auth.token` en la conexión

## 📊 Monitoreo y Salud

Cada servicio expone un endpoint de health check:

- `GET /health` - Estado del servicio

## 🚧 Mejoras Futuras

1. **Service Discovery**: Implementar un sistema de descubrimiento de servicios
2. **Message Queue**: Usar RabbitMQ o Kafka para comunicación asíncrona
3. **API Gateway Avanzado**: 
   - Rate limiting
   - Caching
   - Circuit breaker
4. **Bases de Datos Separadas**: Una base de datos por microservicio
5. **Containerización**: Docker y Docker Compose para desarrollo y despliegue
6. **Orquestación**: Kubernetes para producción
7. **Observabilidad**: Logging centralizado, métricas, tracing

## 📝 Notas Importantes

- **Desarrollo Local**: Todos los servicios deben ejecutarse simultáneamente
- **Puertos**: Asegúrate de que los puertos no estén en uso
- **Firebase**: Todos los servicios comparten la misma configuración de Firebase
- **CORS**: Configurado para permitir el origen del frontend

## 🐛 Troubleshooting

### Error: "Port already in use"
Cambia el puerto en el archivo `.env` o detén el proceso que está usando el puerto.

### Error: "Firebase Admin not initialized"
Verifica que las variables de entorno de Firebase estén correctamente configuradas.

### Error: "Service unavailable" en el Gateway
Asegúrate de que todos los servicios estén ejecutándose y que las URLs en `.env` sean correctas.


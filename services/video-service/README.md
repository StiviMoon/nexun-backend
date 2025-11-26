# 🎥 Video Service

Servicio de videollamadas en tiempo real para Nexun usando WebRTC y Socket.IO.

## 🚀 Ejecución

```bash
npm run dev:video
# O desde la raíz: npm run dev:video
```

Puerto: `3003`

## 📡 Eventos Socket.IO

### Cliente → Servidor

- `video:room:create` - Crear sala
- `video:room:join` - Unirse a sala
- `video:room:leave` - Salir de sala
- `video:signal` - Señalización WebRTC (offer/answer/ice-candidate)
- `video:toggle-audio` - Activar/desactivar audio
- `video:toggle-video` - Activar/desactivar video
- `video:toggle-screen` - Activar/desactivar pantalla
- `video:room:end` - Finalizar sala (solo host)

### Servidor → Cliente

- `video:room:created` - Sala creada
- `video:room:joined` - Unido a sala
- `video:room:left` - Salido de sala
- `video:user:joined` - Usuario se unió
- `video:user:left` - Usuario salió
- `video:signal` - Señalización WebRTC
- `video:audio:toggled` - Audio cambiado
- `video:video:toggled` - Video cambiado
- `video:screen:toggled` - Pantalla cambiada
- `video:room:ended` - Sala finalizada
- `error` - Error ocurrido

## 🔌 Endpoints REST

- `GET /api/video/rooms/:roomId` - Obtener información de sala
- `GET /api/video/rooms/:roomId/participants` - Obtener participantes

## 🔧 Configuración

Variables de entorno requeridas:

```env
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_CLIENT_EMAIL=tu-client-email
FIREBASE_PRIVATE_KEY=tu-private-key
VIDEO_SERVICE_PORT=3003
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

## 📝 Uso en Frontend

Ver `nexun-front/app/hooks/useVideoCall.ts` para el hook completo con SimplePeer.

```typescript
import { useVideoCall } from '@/app/hooks/useVideoCall';

const { connect, createRoom, joinRoom, toggleAudio, toggleVideo } = useVideoCall();
```

# Guía de Integración PeerJS con el Servicio de Video

## Formato de Señales WebRTC

El servicio está completamente compatible con PeerJS y WebRTC nativo. Las señales siguen el formato estándar:

### Offer/Answer Signal
```typescript
{
  type: "offer" | "answer",
  roomId: string,
  fromUserId: string,
  fromUserName?: string,
  fromUserEmail?: string,
  data: {
    type: "offer" | "answer",
    sdp: string
  },
  metadata: {
    hasVideo: boolean,
    hasAudio: boolean,
    videoEnabled: boolean,
    audioEnabled: boolean,
    isScreenSharing: boolean,
    streamType: "camera" | "screen"
  },
  timestamp: string
}
```

### ICE Candidate Signal
```typescript
{
  type: "ice-candidate",
  roomId: string,
  fromUserId: string,
  data: {
    candidate: string,
    sdpMLineIndex: number | null,
    sdpMid: string | null
  },
  metadata: {
    isScreenSharing: boolean,
    streamType: "camera" | "screen"
  },
  timestamp: string
}
```

## Eventos del Servidor

### Eventos que el Cliente debe Escuchar

1. **video:room:joined** - Cuando te unes a una sala
   ```typescript
   {
     roomId: string,
     room: VideoRoom,
     participants: Array<{
       userId: string,
       socketId: string,
       userName?: string,
       userEmail?: string,
       isAudioEnabled: boolean,
       isVideoEnabled: boolean,
       isScreenSharing: boolean
     }>
   }
   ```

2. **video:user:joined** - Cuando otro usuario se une
   ```typescript
   {
     roomId: string,
     userId: string,
     userName?: string,
     userEmail?: string,
     socketId: string,
     isAudioEnabled: boolean,
     isVideoEnabled: boolean,
     isScreenSharing: boolean,
     timestamp: string
   }
   ```

3. **video:signal** - Señales WebRTC (offers, answers, ICE candidates)
   ```typescript
   // Ver formato arriba
   ```

4. **video:stream:ready** - Cuando un usuario tiene su stream listo
   ```typescript
   {
     roomId: string,
     userId: string,
     userName?: string,
     userEmail?: string,
     hasVideo: boolean,
     hasAudio: boolean,
     isScreenSharing: boolean,
     streamId: string,
     streamType: "camera" | "screen",
     timestamp: string
   }
   ```

5. **video:screen:started** - Cuando alguien inicia screen sharing
6. **video:screen:stopped** - Cuando alguien detiene screen sharing
7. **video:screen:toggled** - Cambio de estado de screen sharing
8. **video:audio:toggled** - Cambio de estado de audio
9. **video:video:toggled** - Cambio de estado de video
10. **video:user:left** - Cuando un usuario sale de la sala
11. **video:room:ended** - Cuando la sala termina

## Eventos que el Cliente debe Emitir

1. **video:room:create** - Crear una sala
2. **video:room:join** - Unirse a una sala
3. **video:room:leave** - Salir de una sala
4. **video:signal** - Enviar señales WebRTC
5. **video:stream:ready** - Notificar que el stream está listo
6. **video:screen:start** - Iniciar screen sharing
7. **video:screen:stop** - Detener screen sharing
8. **video:toggle-screen** - Alternar screen sharing
9. **video:toggle-audio** - Alternar audio
10. **video:toggle-video** - Alternar video

## Ejemplo de Uso con PeerJS

```typescript
import Peer from 'peerjs';

// Crear conexión PeerJS
const peer = new Peer({
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  }
});

// Cuando recibes una señal
socket.on('video:signal', async (signal) => {
  if (signal.type === 'offer') {
    // Crear answer
    const answer = await peer.connection.createAnswer();
    await peer.connection.setLocalDescription(answer);
    
    // Enviar answer al servidor
    socket.emit('video:signal', {
      type: 'answer',
      roomId: roomId,
      targetUserId: signal.fromUserId,
      data: {
        type: 'answer',
        sdp: answer.sdp
      }
    });
  } else if (signal.type === 'ice-candidate') {
    // Agregar ICE candidate
    await peer.connection.addIceCandidate(signal.data);
  }
});

// Cuando recibes un stream
peer.on('stream', (stream) => {
  // Mostrar stream en video element
  const video = document.createElement('video');
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  document.body.appendChild(video);
});
```

## Soporte para Múltiples Streams

El servicio soporta múltiples streams simultáneos:
- **Stream de cámara**: Video normal de la cámara del usuario
- **Stream de pantalla**: Screen sharing del usuario

Cada stream tiene un `streamId` único para identificarlo. Puedes tener ambos streams activos al mismo tiempo.

## Configuración Recomendada

- Usar servidores STUN/TURN para NAT traversal
- Habilitar `trickle: false` para enviar ICE candidates en batch
- Usar `autoplay` y `playsInline` en elementos de video
- Manejar errores de conexión y reconexión automática


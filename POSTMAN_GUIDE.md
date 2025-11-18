# 🚀 Guía de Pruebas en Postman

## 📋 Configuración Inicial

### Variables de Entorno en Postman

Crea un entorno en Postman con las siguientes variables:

```
BASE_URL = http://localhost:3000
AUTH_SERVICE = http://localhost:3001
CHAT_SERVICE = http://localhost:3002
VIDEO_SERVICE = http://localhost:3003
TOKEN = (se llenará después del login)
```

## 🔐 1. Auth Service (Autenticación)

### 1.1 Health Check
```
GET {{BASE_URL}}/api/auth/health
```
O directamente:
```
GET {{AUTH_SERVICE}}/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "service": "auth-service",
  "timestamp": "2025-11-18T05:10:06.301Z"
}
```

### 1.2 Registrar Usuario
```
POST {{BASE_URL}}/api/auth/register
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "password123",
  "name": "Usuario de Prueba"
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "user": {
    "uid": "abc123...",
    "email": "usuario@ejemplo.com",
    "displayName": "Usuario de Prueba",
    ...
  },
  "token": "custom-token-here"
}
```

**Script Postman (Tests tab):**
```javascript
if (pm.response.code === 201) {
    const jsonData = pm.response.json();
    if (jsonData.token) {
        pm.environment.set("TOKEN", jsonData.token);
        pm.environment.set("USER_ID", jsonData.user.uid);
    }
}
```

### 1.3 Login
```
POST {{BASE_URL}}/api/auth/login
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "password123"
}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "token": "custom-token-here",
  "user": {
    "uid": "abc123...",
    "email": "usuario@ejemplo.com",
    ...
  }
}
```

**Script Postman (Tests tab):**
```javascript
if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    if (jsonData.token) {
        pm.environment.set("TOKEN", jsonData.token);
        pm.environment.set("USER_ID", jsonData.user.uid);
    }
}
```

### 1.4 Verificar Token
```
POST {{BASE_URL}}/api/auth/verify
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "idToken": "{{TOKEN}}"
}
```

### 1.5 Obtener Perfil del Usuario Actual
```
GET {{BASE_URL}}/api/auth/me
Authorization: Bearer {{TOKEN}}
```

**Respuesta esperada:**
```json
{
  "success": true,
  "user": {
    "uid": "abc123...",
    "email": "usuario@ejemplo.com",
    "displayName": "Usuario de Prueba",
    ...
  }
}
```

### 1.6 Autenticación con Google
```
POST {{BASE_URL}}/api/auth/google
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "idToken": "google-id-token-here"
}
```

### 1.7 Logout
```
POST {{BASE_URL}}/api/auth/logout
Authorization: Bearer {{TOKEN}}
```

## 💬 2. Chat Service

### 2.1 Health Check
```
GET {{CHAT_SERVICE}}/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "service": "chat-service",
  "timestamp": "2025-11-18T05:10:06.321Z",
  "onlineUsers": 0
}
```

### 2.2 WebSocket (Chat en Tiempo Real)

**⚠️ Nota:** Postman tiene soporte limitado para WebSocket. Para probar el chat en tiempo real, usa una de estas opciones:

#### Opción A: Usar Postman WebSocket (v10.0+)
1. Crea una nueva WebSocket request
2. URL: `ws://localhost:3002`
3. En "Params" o "Headers", agrega:
   - `token`: `{{TOKEN}}` (en query params o auth)

**Eventos a enviar:**
```json
// Unirse a una sala
{
  "event": "room:join",
  "data": {
    "roomId": "room-id-here"
  }
}

// Enviar mensaje
{
  "event": "message:send",
  "data": {
    "roomId": "room-id-here",
    "content": "Hola desde Postman!",
    "type": "text"
  }
}

// Crear sala
{
  "event": "room:create",
  "data": {
    "name": "Sala de Prueba",
    "type": "group",
    "description": "Sala creada desde Postman"
  }
}
```

#### Opción B: Usar herramienta externa
- **Socket.IO Client**: https://amritb.github.io/socketio-client-tool/
- **wscat**: `npm install -g wscat` luego `wscat -c "ws://localhost:3002?token=YOUR_TOKEN"`

## 🎥 3. Video Service

### 3.1 Health Check
```
GET {{VIDEO_SERVICE}}/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "service": "video-service",
  "timestamp": "2025-11-18T05:10:06.356Z"
}
```

### 3.2 WebSocket (Videollamadas)

**URL:** `ws://localhost:3003`

**Eventos a enviar:**

```json
// Crear sala de videollamada
{
  "event": "video:room:create",
  "data": {
    "name": "Reunión de Prueba",
    "description": "Reunión desde Postman",
    "maxParticipants": 10
  }
}

// Unirse a sala
{
  "event": "video:room:join",
  "data": {
    "roomId": "room-id-here"
  }
}

// Señalización WebRTC (offer)
{
  "event": "video:signal",
  "data": {
    "type": "offer",
    "roomId": "room-id-here",
    "targetUserId": "user-id-here",
    "data": {
      "sdp": "...",
      "type": "offer"
    }
  }
}

// Toggle audio
{
  "event": "video:toggle-audio",
  "data": {
    "roomId": "room-id-here",
    "enabled": false
  }
}

// Toggle video
{
  "event": "video:toggle-video",
  "data": {
    "roomId": "room-id-here",
    "enabled": false
  }
}

// Salir de sala
{
  "event": "video:room:leave",
  "data": {
    "roomId": "room-id-here"
  }
}
```

## 🌐 4. API Gateway

### 4.1 Health Check
```
GET {{BASE_URL}}/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "service": "api-gateway",
  "timestamp": "2025-11-18T05:10:06.018Z",
  "services": {
    "auth": "http://localhost:3001",
    "chat": "http://localhost:3002",
    "video": "http://localhost:3003"
  }
}
```

## 📝 5. Colección de Postman Completa

### Estructura Recomendada

```
Nexun Backend API
├── Auth Service
│   ├── Health Check
│   ├── Register
│   ├── Login
│   ├── Verify Token
│   ├── Get Profile (Me)
│   ├── Google Auth
│   └── Logout
│
├── Chat Service
│   ├── Health Check
│   └── WebSocket (Chat)
│
├── Video Service
│   ├── Health Check
│   └── WebSocket (Video)
│
└── API Gateway
    └── Health Check
```

## 🔧 6. Scripts Útiles para Postman

### Pre-request Script (Para todas las requests autenticadas)
```javascript
// Agregar token automáticamente si existe
const token = pm.environment.get("TOKEN");
if (token) {
    pm.request.headers.add({
        key: "Authorization",
        value: `Bearer ${token}`
    });
}
```

### Test Script (Para verificar respuestas)
```javascript
// Verificar que la respuesta sea exitosa
pm.test("Status code is 200 or 201", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
});

// Verificar estructura de respuesta
pm.test("Response has success field", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success');
});
```

## 🐛 7. Troubleshooting

### Error: "Service unavailable"
- Verifica que todos los servicios estén corriendo
- Revisa los logs en la terminal
- Verifica las URLs en las variables de entorno

### Error: "Unauthorized" o "Invalid token"
- Asegúrate de haber hecho login primero
- Verifica que el token esté en la variable `TOKEN`
- El token puede haber expirado, vuelve a hacer login

### WebSocket no conecta
- Verifica que el servicio esté corriendo
- Asegúrate de incluir el token en la conexión
- Usa `ws://` en lugar de `http://` para WebSocket

## 📦 8. Exportar Colección

Para compartir la colección:
1. Click en "..." al lado de la colección
2. Selecciona "Export"
3. Elige formato "Collection v2.1"
4. Guarda el archivo JSON

## 🎯 9. Flujo de Prueba Recomendado

1. **Health Checks**: Verifica que todos los servicios estén activos
2. **Register/Login**: Obtén un token de autenticación
3. **Get Profile**: Verifica que el token funciona
4. **Chat/Video**: Prueba los WebSockets (usando herramienta externa si es necesario)

## 🔗 10. Herramientas Alternativas para WebSocket

- **Socket.IO Client Tool**: https://amritb.github.io/socketio-client-tool/
- **wscat**: CLI tool para WebSocket
- **Insomnia**: Tiene mejor soporte para WebSocket que Postman
- **Thunder Client** (VS Code): Extensión con soporte WebSocket


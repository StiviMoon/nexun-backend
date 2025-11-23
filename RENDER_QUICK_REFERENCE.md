# ⚡ Referencia Rápida: Despliegue en Render

## 📋 Comandos de Build y Start por Servicio

### Auth Service
```bash
Build:  npm install && npm run build:auth
Start:  npm run start:auth
Health: /health
```

### Chat Service
```bash
Build:  npm install && npm run build:chat
Start:  npm run start:chat
Health: /health
```

### Video Service
```bash
Build:  npm install && npm run build:video
Start:  npm run start:video
Health: /health
```

### API Gateway
```bash
Build:  npm install && npm run build:gateway
Start:  npm run start:gateway
Health: /health
```

---

## 🔐 Variables de Entorno por Servicio

### Auth, Chat, Video Services (Mismas variables)

```env
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-project.iam.gserviceaccount.com
CORS_ORIGIN=https://tu-frontend.com,https://www.tu-frontend.com
```

### API Gateway (Incluye URLs de otros servicios)

```env
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-project.iam.gserviceaccount.com
CORS_ORIGIN=https://tu-frontend.com,https://www.tu-frontend.com

# URLs de los otros servicios (reemplaza con tus URLs reales)
AUTH_SERVICE_URL=https://nexun-auth-service.onrender.com
CHAT_SERVICE_URL=https://nexun-chat-service.onrender.com
VIDEO_SERVICE_URL=https://nexun-video-service.onrender.com
```

---

## 📝 Checklist de Despliegue

### Paso 1: Auth Service
- [ ] Crear servicio: `nexun-auth-service`
- [ ] Build: `npm install && npm run build:auth`
- [ ] Start: `npm run start:auth`
- [ ] Health: `/health`
- [ ] Variables de entorno configuradas
- [ ] Servicio Live
- [ ] Copiar URL: `https://nexun-auth-service.onrender.com`

### Paso 2: Chat Service
- [ ] Crear servicio: `nexun-chat-service`
- [ ] Build: `npm install && npm run build:chat`
- [ ] Start: `npm run start:chat`
- [ ] Health: `/health`
- [ ] Variables de entorno configuradas
- [ ] Servicio Live
- [ ] Copiar URL: `https://nexun-chat-service.onrender.com`

### Paso 3: Video Service
- [ ] Crear servicio: `nexun-video-service`
- [ ] Build: `npm install && npm run build:video`
- [ ] Start: `npm run start:video`
- [ ] Health: `/health`
- [ ] Variables de entorno configuradas
- [ ] Servicio Live
- [ ] Copiar URL: `https://nexun-video-service.onrender.com`

### Paso 4: API Gateway
- [ ] Crear servicio: `nexun-api-gateway`
- [ ] Build: `npm install && npm run build:gateway`
- [ ] Start: `npm run start:gateway`
- [ ] Health: `/health`
- [ ] Variables de entorno configuradas (incluyendo URLs de otros servicios)
- [ ] Servicio Live
- [ ] Verificar: `https://nexun-api-gateway.onrender.com/health`
- [ ] Verificar Swagger: `https://nexun-api-gateway.onrender.com/api-docs`

---

## 🔗 URLs Finales

Después del despliegue, guarda estas URLs:

```
API Gateway:    https://nexun-api-gateway.onrender.com
Auth Service:  https://nexun-auth-service.onrender.com
Chat Service:  https://nexun-chat-service.onrender.com
Video Service: https://nexun-video-service.onrender.com
```

**Usa el API Gateway en tu frontend:**
```javascript
const API_URL = 'https://nexun-api-gateway.onrender.com';
const SOCKET_URL = 'https://nexun-api-gateway.onrender.com';
```

---

## ⚠️ Notas Importantes

1. **FIREBASE_PRIVATE_KEY**: Debe estar entre comillas dobles con `\n` literales
2. **Orden de despliegue**: Auth → Chat → Video → API Gateway
3. **URLs en API Gateway**: Usa las URLs exactas que Render asigna
4. **Health Checks**: Todos los servicios usan `/health`
5. **Free Tier**: Los servicios se duermen después de 15 min de inactividad

---

## 🐛 Problemas Comunes

| Problema | Solución |
|----------|----------|
| Build falla | Verifica que todas las dependencias estén en `package.json` |
| Servicio no inicia | Revisa los logs en Render Dashboard |
| API Gateway 503 | Verifica que las URLs de servicios sean correctas |
| CORS errors | Verifica `CORS_ORIGIN` incluye la URL exacta del frontend |
| Firebase error | Verifica formato de `FIREBASE_PRIVATE_KEY` (con `\n`) |

---

**Para más detalles, consulta**: `RENDER_DEPLOY_SEPARADO.md`


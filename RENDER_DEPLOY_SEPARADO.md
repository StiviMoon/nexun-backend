# 🚀 Guía: Desplegar Cada Servicio por Separado en Render

Esta guía te lleva paso a paso para desplegar cada microservicio de forma independiente en Render.

## 📋 Tabla de Contenidos

- [Pre-requisitos](#pre-requisitos)
- [Orden de Despliegue](#orden-de-despliegue)
- [Paso 1: Auth Service](#paso-1-auth-service)
- [Paso 2: Chat Service](#paso-2-chat-service)
- [Paso 3: Video Service](#paso-3-video-service)
- [Paso 4: API Gateway](#paso-4-api-gateway)
- [Verificación Final](#verificación-final)
- [Troubleshooting](#troubleshooting)

---

## ✅ Pre-requisitos

1. ✅ Cuenta en [Render](https://render.com) (gratis)
2. ✅ Repositorio Git (GitHub/GitLab/Bitbucket) con tu código
3. ✅ Credenciales de Firebase listas:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_CLIENT_EMAIL`
4. ✅ URL de tu frontend para CORS

---

## 🎯 Orden de Despliegue

**Importante**: Despliega los servicios en este orden porque el API Gateway necesita las URLs de los otros servicios:

1. **Auth Service** (primero)
2. **Chat Service** (segundo)
3. **Video Service** (tercero)
4. **API Gateway** (último - necesita las URLs de los anteriores)

---

## 🔐 Paso 1: Auth Service

### 1.1. Crear el Servicio

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Click en **"New +"** → **"Web Service"**
3. Conecta tu repositorio:
   - Si es la primera vez, autoriza Render a acceder a tu repositorio
   - Selecciona el repositorio `nexun-backend`
4. Configura el servicio:

   **Información Básica:**
   - **Name**: `nexun-auth-service`
   - **Region**: `Oregon` (o la más cercana a ti)
   - **Branch**: `main` (o tu rama principal)
   - **Root Directory**: (deja vacío, usa la raíz)

   **Build & Deploy:**
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build:auth`
   - **Start Command**: `npm run start:auth`

   **Plan:**
   - **Instance Type**: `Free` (para empezar) o `Starter` ($7/mes)

### 1.2. Configurar Variables de Entorno

En la sección **"Environment"** → **"Environment Variables"**, agrega:

```env
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-project.iam.gserviceaccount.com
CORS_ORIGIN=https://tu-frontend.com,https://www.tu-frontend.com
```

**⚠️ Importante sobre FIREBASE_PRIVATE_KEY:**
- Debe estar entre comillas dobles `"`
- Los saltos de línea deben ser `\n` literalmente
- Copia la key completa desde Firebase Console

### 1.3. Configurar Health Check

- **Health Check Path**: `/health`

### 1.4. Desplegar

1. Click en **"Create Web Service"**
2. Espera a que el build termine (puede tardar 2-5 minutos)
3. Verifica que el estado sea **"Live"** (verde)

### 1.5. Obtener la URL

Una vez desplegado, copia la URL del servicio:
- Ejemplo: `https://nexun-auth-service.onrender.com`
- **Guarda esta URL** - la necesitarás para el API Gateway

### 1.6. Verificar

Abre en tu navegador:
```
https://nexun-auth-service.onrender.com/health
```

Deberías ver:
```json
{
  "status": "ok",
  "service": "auth-service",
  "timestamp": "2024-11-23T..."
}
```

---

## 💬 Paso 2: Chat Service

### 2.1. Crear el Servicio

Repite el proceso del Paso 1, pero con estos valores:

**Información Básica:**
- **Name**: `nexun-chat-service`

**Build & Deploy:**
- **Build Command**: `npm install && npm run build:chat`
- **Start Command**: `npm run start:chat`

### 2.2. Configurar Variables de Entorno

Mismas variables que Auth Service:

```env
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-project.iam.gserviceaccount.com
CORS_ORIGIN=https://tu-frontend.com,https://www.tu-frontend.com
```

### 2.3. Configurar Health Check

- **Health Check Path**: `/health`

### 2.4. Desplegar y Verificar

1. Click en **"Create Web Service"**
2. Espera a que esté **"Live"**
3. Copia la URL: `https://nexun-chat-service.onrender.com`
4. Verifica: `https://nexun-chat-service.onrender.com/health`

---

## 🎥 Paso 3: Video Service

### 3.1. Crear el Servicio

**Información Básica:**
- **Name**: `nexun-video-service`

**Build & Deploy:**
- **Build Command**: `npm install && npm run build:video`
- **Start Command**: `npm run start:video`

### 3.2. Configurar Variables de Entorno

Mismas variables que los servicios anteriores:

```env
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-project.iam.gserviceaccount.com
CORS_ORIGIN=https://tu-frontend.com,https://www.tu-frontend.com
```

### 3.3. Configurar Health Check

- **Health Check Path**: `/health`

### 3.4. Desplegar y Verificar

1. Click en **"Create Web Service"**
2. Espera a que esté **"Live"**
3. Copia la URL: `https://nexun-video-service.onrender.com`
4. Verifica: `https://nexun-video-service.onrender.com/health`

---

## 🌐 Paso 4: API Gateway

### 4.1. Crear el Servicio

**Información Básica:**
- **Name**: `nexun-api-gateway`

**Build & Deploy:**
- **Build Command**: `npm install && npm run build:gateway`
- **Start Command**: `npm run start:gateway`

### 4.2. Configurar Variables de Entorno

**Variables de Firebase:**
```env
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-project.iam.gserviceaccount.com
CORS_ORIGIN=https://tu-frontend.com,https://www.tu-frontend.com
```

**⚠️ IMPORTANTE: URLs de los otros servicios**

Usa las URLs que copiaste de los servicios anteriores:

```env
AUTH_SERVICE_URL=https://nexun-auth-service.onrender.com
CHAT_SERVICE_URL=https://nexun-chat-service.onrender.com
VIDEO_SERVICE_URL=https://nexun-video-service.onrender.com
```

**Reemplaza los nombres** con los nombres reales que usaste en Render.

### 4.3. Configurar Health Check

- **Health Check Path**: `/health`

### 4.4. Desplegar y Verificar

1. Click en **"Create Web Service"**
2. Espera a que esté **"Live"**
3. Copia la URL: `https://nexun-api-gateway.onrender.com`

### 4.5. Verificaciones

**Health Check:**
```
https://nexun-api-gateway.onrender.com/health
```

Deberías ver:
```json
{
  "status": "ok",
  "service": "api-gateway",
  "timestamp": "...",
  "services": {
    "auth": "https://nexun-auth-service.onrender.com",
    "chat": "https://nexun-chat-service.onrender.com",
    "video": "https://nexun-video-service.onrender.com"
  }
}
```

**Documentación Swagger:**
```
https://nexun-api-gateway.onrender.com/api-docs
```

---

## ✅ Verificación Final

### Checklist de Verificación

- [ ] Auth Service está Live y responde en `/health`
- [ ] Chat Service está Live y responde en `/health`
- [ ] Video Service está Live y responde en `/health`
- [ ] API Gateway está Live y responde en `/health`
- [ ] API Gateway muestra las URLs correctas de los servicios
- [ ] Swagger UI está accesible en `/api-docs`
- [ ] Puedes hacer requests al API Gateway desde tu frontend

### Probar Endpoints

**Auth Service (directo):**
```bash
curl https://nexun-auth-service.onrender.com/health
```

**API Gateway (a través del gateway):**
```bash
curl https://nexun-api-gateway.onrender.com/api/auth/verify
```

**Chat Service (directo):**
```bash
curl https://nexun-chat-service.onrender.com/health
```

**Video Service (directo):**
```bash
curl https://nexun-video-service.onrender.com/health
```

---

## 🐛 Troubleshooting

### Problema: Servicio no inicia

**Síntomas**: Build exitoso pero servicio no arranca.

**Solución**:
1. Ve a **Logs** en Render Dashboard
2. Busca errores como "Cannot find module" o "Port already in use"
3. Verifica que el `startCommand` sea correcto
4. Asegúrate de que todas las dependencias estén en `package.json`

### Problema: Error "Cannot find module"

**Solución**:
1. Verifica que el `buildCommand` compile correctamente
2. Revisa que los paths en `tsconfig.json` sean correctos
3. Asegúrate de que `shared/` esté incluido en el build

### Problema: API Gateway no puede conectar con otros servicios

**Síntomas**: Errores 503 o "Service unavailable" en el API Gateway.

**Solución**:
1. Verifica que las URLs en las variables de entorno sean correctas
2. Asegúrate de que todos los servicios estén "Live"
3. Verifica que los health checks funcionen
4. Revisa los logs del API Gateway para ver errores específicos

### Problema: CORS errors

**Síntomas**: El frontend no puede hacer requests.

**Solución**:
1. Verifica que `CORS_ORIGIN` incluya la URL exacta de tu frontend
2. Asegúrate de incluir `https://` (no `http://` en producción)
3. Si tienes múltiples orígenes, sepáralos por comas: `https://app.com,https://www.app.com`
4. Verifica que `credentials: true` esté configurado en el frontend

### Problema: Firebase Authentication no funciona

**Síntomas**: Errores de "Firebase Admin not initialized".

**Solución**:
1. Verifica que `FIREBASE_PRIVATE_KEY` tenga el formato correcto:
   - Debe estar entre comillas dobles
   - Los `\n` deben ser literales (no saltos de línea reales)
2. Copia la key completa desde Firebase Console
3. Verifica que `FIREBASE_PROJECT_ID` y `FIREBASE_CLIENT_EMAIL` sean correctos

### Problema: Servicios se duermen (Free Tier)

**Síntomas**: Los servicios tardan mucho en responder después de inactividad.

**Explicación**: En el plan gratuito, los servicios se "duermen" después de 15 minutos de inactividad. La primera request puede tardar 30-60 segundos.

**Soluciones**:
1. Usa un servicio de ping (ej: [UptimeRobot](https://uptimerobot.com)) para mantener los servicios activos
2. Actualiza a un plan de pago ($7/mes por servicio)
3. Acepta el delay inicial (solo afecta la primera request)

---

## 📝 Resumen de URLs

Después del despliegue, tendrás estas URLs:

```
API Gateway:    https://nexun-api-gateway.onrender.com
Auth Service:  https://nexun-auth-service.onrender.com
Chat Service:  https://nexun-chat-service.onrender.com
Video Service: https://nexun-video-service.onrender.com
```

**Usa el API Gateway** como punto de entrada principal desde tu frontend:
```
https://nexun-api-gateway.onrender.com/api/auth/...
https://nexun-api-gateway.onrender.com/api/chat/...
https://nexun-api-gateway.onrender.com/api/video/...
```

---

## 🔄 Actualizar Servicios

Para actualizar un servicio después de cambios:

1. Haz push a tu repositorio
2. Render detectará automáticamente los cambios
3. Iniciará un nuevo build y deploy
4. El servicio se actualizará sin downtime (si está en plan de pago)

O manualmente:
1. Ve al servicio en Render Dashboard
2. Click en **"Manual Deploy"** → **"Deploy latest commit"**

---

## 💰 Costos

### Plan Free
- **Costo**: $0/mes
- **Limitaciones**:
  - Servicios se duermen después de 15 min de inactividad
  - Build time limitado
  - Menos recursos

### Plan Starter ($7/mes por servicio)
- **Costo**: $28/mes total (4 servicios)
- **Ventajas**:
  - Servicios siempre activos
  - Más recursos
  - Mejor rendimiento
  - Soporte prioritario

**Recomendación**: Empieza con Free para pruebas, actualiza a Starter para producción.

---

## 📚 Recursos Adicionales

- [Render Documentation](https://render.com/docs)
- [Render Web Services](https://render.com/docs/web-services)
- [Environment Variables](https://render.com/docs/environment-variables)

---

**Última actualización**: Noviembre 2024  
**Versión**: 1.0.0


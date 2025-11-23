# 🚀 Guía de Despliegue en Render

Esta guía explica cómo desplegar el backend de Nexun en Render. Tienes dos opciones principales:

## 📋 Tabla de Contenidos

- [Opciones de Despliegue](#opciones-de-despliegue)
- [Opción 1: Microservicios Separados (Recomendado)](#opción-1-microservicios-separados-recomendado)
- [Opción 2: Servicio Único (Simple)](#opción-2-servicio-único-simple)
- [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
- [Pasos de Despliegue](#pasos-de-despliegue)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Opciones de Despliegue

### Opción 1: Microservicios Separados ⭐ (Recomendado)

**Ventajas:**
- ✅ Escalabilidad independiente por servicio
- ✅ Mejor para producción y alto tráfico
- ✅ Aislamiento de fallos
- ✅ Actualizaciones independientes

**Desventajas:**
- ⚠️ Requiere 4 servicios en Render (más costoso)
- ⚠️ Configuración más compleja

### Opción 2: Servicio Único

**Ventajas:**
- ✅ Más simple de configurar
- ✅ Un solo servicio (más económico)
- ✅ Fácil de mantener

**Desventajas:**
- ⚠️ Menos escalable
- ⚠️ Si un servicio falla, todos fallan
- ⚠️ No puedes escalar servicios individualmente

---

## 🏗️ Opción 1: Microservicios Separados (Recomendado)

Desplegarás 4 servicios independientes en Render:

1. **API Gateway** (puerto 3000)
2. **Auth Service** (puerto 3001)
3. **Chat Service** (puerto 3002)
4. **Video Service** (puerto 3003)

### Paso 1: Preparar el Repositorio

Asegúrate de que tu código esté en GitHub/GitLab/Bitbucket.

### Paso 2: Crear Servicios en Render

#### 2.1. Auth Service

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Click en **"New +"** → **"Web Service"**
3. Conecta tu repositorio
4. Configuración:
   - **Name**: `nexun-auth-service`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build:auth`
   - **Start Command**: `npm run start:auth`
   - **Instance Type**: `Free` o `Starter` ($7/mes)

#### 2.2. Chat Service

Repite el proceso:
- **Name**: `nexun-chat-service`
- **Build Command**: `npm install && npm run build:chat`
- **Start Command**: `npm run start:chat`

#### 2.3. Video Service

- **Name**: `nexun-video-service`
- **Build Command**: `npm install && npm run build:video`
- **Start Command**: `npm run start:video`

#### 2.4. API Gateway

- **Name**: `nexun-api-gateway`
- **Build Command**: `npm install && npm run build:gateway`
- **Start Command**: `npm run start:gateway`

### Paso 3: Configurar Variables de Entorno

Para cada servicio, agrega las variables de entorno necesarias (ver sección [Variables de Entorno](#configuración-de-variables-de-entorno)).

**Importante**: En el API Gateway, las URLs de los servicios deben apuntar a las URLs de Render:

```env
AUTH_SERVICE_URL=https://nexun-auth-service.onrender.com
CHAT_SERVICE_URL=https://nexun-chat-service.onrender.com
VIDEO_SERVICE_URL=https://nexun-video-service.onrender.com
```

### Paso 4: Configurar Health Checks

Render necesita saber si tu servicio está funcionando. Cada servicio ya tiene un endpoint `/health`.

**Health Check Path**: `/health`

---

## 🔧 Opción 2: Servicio Único (Simple)

Si prefieres desplegar todo como un solo servicio:

### Paso 1: Crear Servicio en Render

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Click en **"New +"** → **"Web Service"**
3. Conecta tu repositorio
4. Configuración:
   - **Name**: `nexun-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Instance Type**: `Free` o `Starter`

### Paso 2: Variables de Entorno

Configura todas las variables de entorno necesarias (ver sección siguiente).

### Paso 3: Health Check

**Health Check Path**: `/health` (del API Gateway)

---

## 🔐 Configuración de Variables de Entorno

### Variables Comunes (Todos los Servicios)

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# CORS Origins (separados por comas)
CORS_ORIGIN=https://tu-frontend.com,https://www.tu-frontend.com
```

### API Gateway

```env
# Puerto (Render lo asigna automáticamente, pero puedes usar PORT)
PORT=10000
GATEWAY_PORT=10000

# URLs de los microservicios (Opción 1) o localhost (Opción 2)
AUTH_SERVICE_URL=https://nexun-auth-service.onrender.com
CHAT_SERVICE_URL=https://nexun-chat-service.onrender.com
VIDEO_SERVICE_URL=https://nexun-video-service.onrender.com

# CORS
CORS_ORIGIN=https://tu-frontend.com
```

### Auth Service

```env
PORT=10000
AUTH_SERVICE_PORT=10000
CORS_ORIGIN=https://tu-frontend.com
```

### Chat Service

```env
PORT=10000
CHAT_SERVICE_PORT=10000
CORS_ORIGIN=https://tu-frontend.com
```

### Video Service

```env
PORT=10000
VIDEO_SERVICE_PORT=10000
CORS_ORIGIN=https://tu-frontend.com
```

### ⚠️ Nota Importante sobre PORT

Render asigna automáticamente el puerto a través de la variable `PORT`. Asegúrate de que tus servicios usen `process.env.PORT` en lugar de puertos fijos.

---

## 📝 Pasos de Despliegue Detallados

### Pre-requisitos

1. ✅ Cuenta en Render (gratis disponible)
2. ✅ Repositorio Git (GitHub/GitLab/Bitbucket)
3. ✅ Credenciales de Firebase configuradas
4. ✅ Código actualizado (los servicios ya usan `process.env.PORT`)

### Paso 1: Usar Blueprint (Método Rápido) ⚡

Si tienes el archivo `render.yaml` en tu repositorio:

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Click en **"New +"** → **"Blueprint"**
3. Conecta tu repositorio
4. Render detectará automáticamente el `render.yaml`
5. Revisa la configuración y haz click en **"Apply"**
6. Render creará los 4 servicios automáticamente
7. Configura las variables de entorno (ver Paso 3)

### Paso 2: Desplegar Manualmente (Sin Blueprint)

Si prefieres configurar cada servicio manualmente:

1. **Crear Auth Service**:
   - Ve a [Render Dashboard](https://dashboard.render.com)
   - Click en **"New +"** → **"Web Service"**
   - Conecta tu repositorio
   - **Name**: `nexun-auth-service`
   - **Build Command**: `npm install && npm run build:auth`
   - **Start Command**: `npm run start:auth`
   - **Health Check Path**: `/health`

2. **Crear Chat Service**:
   - Repite el proceso con:
   - **Name**: `nexun-chat-service`
   - **Build Command**: `npm install && npm run build:chat`
   - **Start Command**: `npm run start:chat`
   - **Health Check Path**: `/health`

3. **Crear Video Service**:
   - **Name**: `nexun-video-service`
   - **Build Command**: `npm install && npm run build:video`
   - **Start Command**: `npm run start:video`
   - **Health Check Path**: `/health`

4. **Crear API Gateway**:
   - **Name**: `nexun-api-gateway`
   - **Build Command**: `npm install && npm run build:gateway`
   - **Start Command**: `npm run start:gateway`
   - **Health Check Path**: `/health`
   - **Importante**: Después de crear los otros servicios, configura sus URLs en las variables de entorno

### Paso 3: Configurar Variables de Entorno

**IMPORTANTE**: Después de crear los servicios, debes configurar las variables de entorno manualmente en cada servicio.

Para cada servicio, ve a **Environment** → **Environment Variables** y agrega:

1. **Firebase Credentials** (todos los servicios):

   ```
   FIREBASE_PROJECT_ID=tu-project-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-project.iam.gserviceaccount.com
   ```

2. **CORS Origins** (todos los servicios):
   ```
   CORS_ORIGIN=https://tu-frontend.com,https://www.tu-frontend.com
   ```

3. **Service URLs** (solo API Gateway, si usas Opción 1 - Microservicios Separados):
   ```
   AUTH_SERVICE_URL=https://nexun-auth-service.onrender.com
   CHAT_SERVICE_URL=https://nexun-chat-service.onrender.com
   VIDEO_SERVICE_URL=https://nexun-video-service.onrender.com
   ```

   **Nota**: Reemplaza los nombres de servicio con los nombres reales que usaste en Render.

### Paso 4: Verificar Despliegue

1. Espera a que todos los servicios estén "Live"
2. Verifica los health checks:
   - `https://nexun-api-gateway.onrender.com/health`
   - `https://nexun-auth-service.onrender.com/health`
   - `https://nexun-chat-service.onrender.com/health`
   - `https://nexun-video-service.onrender.com/health`

3. Prueba el API Gateway:
   - `https://nexun-api-gateway.onrender.com/api-docs`

---

---

## 🐛 Troubleshooting

### Problema: Servicio no inicia

**Síntomas**: El servicio muestra "Build successful" pero no inicia.

**Soluciones**:
1. Verifica los logs en Render Dashboard → Logs
2. Asegúrate de que el `startCommand` sea correcto
3. Verifica que todas las dependencias estén instaladas
4. Revisa que `PORT` esté configurado correctamente

### Problema: Error "Cannot find module"

**Síntomas**: Error durante el build o start.

**Soluciones**:
1. Verifica que `package.json` tenga todas las dependencias
2. Asegúrate de que el build se ejecute antes del start
3. Verifica que los paths en `tsconfig.json` sean correctos

### Problema: Servicios no se comunican entre sí

**Síntomas**: API Gateway no puede conectar con otros servicios.

**Soluciones**:
1. Verifica que las URLs en `AUTH_SERVICE_URL`, `CHAT_SERVICE_URL`, `VIDEO_SERVICE_URL` sean correctas
2. Asegúrate de que todos los servicios estén "Live"
3. Verifica que los health checks funcionen: `/health`
4. Revisa los logs del API Gateway para ver errores de conexión

### Problema: CORS errors en el frontend

**Síntomas**: El frontend no puede hacer requests al backend.

**Soluciones**:
1. Verifica que `CORS_ORIGIN` incluya la URL exacta de tu frontend
2. Asegúrate de incluir `https://` en las URLs
3. Si tienes múltiples orígenes, sepáralos por comas sin espacios
4. Verifica que `credentials: true` esté configurado en el frontend

### Problema: Firebase Authentication no funciona

**Síntomas**: Errores de autenticación o "Firebase Admin not initialized".

**Soluciones**:
1. Verifica que `FIREBASE_PRIVATE_KEY` tenga el formato correcto (con `\n`)
2. Asegúrate de que la key esté entre comillas dobles en Render
3. Verifica que `FIREBASE_PROJECT_ID` y `FIREBASE_CLIENT_EMAIL` sean correctos
4. Revisa los logs para ver errores específicos de Firebase

### Problema: WebSocket no funciona

**Síntomas**: Socket.IO no se conecta.

**Soluciones**:
1. Verifica que el API Gateway tenga WebSocket habilitado
2. Asegúrate de usar `wss://` en producción (HTTPS)
3. Verifica que los servicios de chat y video estén accesibles
4. Revisa la configuración de CORS para WebSocket

### Problema: Servicios se duermen (Free Tier)

**Síntomas**: Los servicios tardan mucho en responder después de inactividad.

**Explicación**: En el plan gratuito de Render, los servicios se "duermen" después de 15 minutos de inactividad. La primera request después de esto puede tardar 30-60 segundos.

**Soluciones**:
1. Usa un servicio de "ping" para mantener los servicios activos (ej: UptimeRobot)
2. Actualiza a un plan de pago ($7/mes por servicio)
3. Acepta el delay inicial (solo afecta la primera request)

---

## 📊 Verificar que los Servicios Usan PORT Correctamente

✅ **Ya está configurado**: Los servicios ahora usan `process.env.PORT || servicePort || defaultPort`, lo que significa que:
- Render asigna automáticamente el puerto a través de `PORT`
- Si `PORT` no está disponible, usa el puerto específico del servicio
- Si ninguno está disponible, usa el puerto por defecto

No necesitas hacer nada adicional.

---

## 📋 Resumen Rápido

### Checklist de Despliegue

- [ ] Código en repositorio Git (GitHub/GitLab/Bitbucket)
- [ ] Archivo `render.yaml` creado (opcional pero recomendado)
- [ ] Servicios actualizados para usar `process.env.PORT` ✅ (ya hecho)
- [ ] Crear 4 servicios en Render (o usar Blueprint)
- [ ] Configurar variables de entorno en cada servicio:
  - [ ] `FIREBASE_PROJECT_ID`
  - [ ] `FIREBASE_PRIVATE_KEY` (con formato correcto)
  - [ ] `FIREBASE_CLIENT_EMAIL`
  - [ ] `CORS_ORIGIN`
  - [ ] URLs de servicios (solo en API Gateway)
- [ ] Verificar health checks de todos los servicios
- [ ] Probar API Gateway: `/api-docs`

### URLs Importantes

Después del despliegue, tendrás:

- **API Gateway**: `https://nexun-api-gateway.onrender.com`
- **Auth Service**: `https://nexun-auth-service.onrender.com`
- **Chat Service**: `https://nexun-chat-service.onrender.com`
- **Video Service**: `https://nexun-video-service.onrender.com`

### Costos Estimados

- **Plan Free**: $0/mes (4 servicios, pero se duermen después de 15 min)
- **Plan Starter**: $7/mes por servicio = $28/mes total (recomendado para producción)

---

## 🔗 Recursos Adicionales

- [Render Documentation](https://render.com/docs)
- [Render Blueprint Spec](https://render.com/docs/blueprint-spec)
- [Node.js on Render](https://render.com/docs/node)

---

**Última actualización**: Noviembre 2024  
**Versión**: 1.0.0

<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
grep

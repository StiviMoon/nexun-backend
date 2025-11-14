# Nexun Backend API

Backend API para autenticación de Nexun usando Firebase Admin SDK.

## Características

- Autenticación con email/password
- Autenticación con Google
- Verificación de tokens Firebase
- Gestión de perfiles de usuario
- Guardado de perfiles en Firestore

## Requisitos Previos

- Node.js 18 o superior
- npm o pnpm
- Cuenta de Firebase con proyecto configurado
- Credenciales de Firebase Admin SDK (service account)

## Configuración

1. **Instalar dependencias:**
```bash
npm install
# o
pnpm install
```

2. **Configurar variables de entorno:**
Copia el archivo `.env.example` a `.env` y completa las variables:

```env
PORT=3001
NODE_ENV=development

# Firebase Admin SDK Configuration
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_CLIENT_EMAIL=tu-service-account@tu-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nTu clave privada aquí\n-----END PRIVATE KEY-----\n

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

### Obtener credenciales de Firebase Admin SDK

1. Ve a la [Consola de Firebase](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Configuración del proyecto** > **Cuentas de servicio**
4. Haz clic en **Generar nueva clave privada**
5. Descarga el archivo JSON
6. Extrae los siguientes valores del JSON:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (mantén los `\n` literales)

## Desarrollo

```bash
npm run dev
# o
pnpm dev
```

El servidor estará disponible en `http://localhost:3001`

## Producción

```bash
npm run build
npm start
```

## Endpoints de la API

### POST /auth/register
Registra un nuevo usuario con email y contraseña.

**Request:**
```json
{
  "email": "usuario@example.com",
  "password": "contraseña123",
  "name": "Nombre del Usuario" // opcional
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "uid": "user-id",
    "email": "usuario@example.com",
    "displayName": "Nombre del Usuario",
    "photoURL": null,
    "providerIds": ["password"],
    "emailVerified": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /auth/login
Inicia sesión con email y contraseña.

**Request:**
```json
{
  "email": "usuario@example.com",
  "password": "contraseña123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "custom-token-here"
}
```

### POST /auth/google
Autentica con Google usando un token ID de Firebase.

**Request:**
```json
{
  "idToken": "firebase-id-token"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "uid": "user-id",
    "email": "usuario@gmail.com",
    "displayName": "Nombre del Usuario",
    "photoURL": "https://...",
    "providerIds": ["google.com"],
    "emailVerified": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /auth/verify
Verifica un token de Firebase y devuelve el perfil del usuario.

**Request:**
```json
{
  "idToken": "firebase-id-token"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "uid": "user-id",
    "email": "usuario@example.com",
    "displayName": "Nombre del Usuario",
    "photoURL": null,
    "providerIds": ["password"],
    "emailVerified": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /auth/logout
Cierra la sesión del usuario.

**Headers:**
```
Authorization: Bearer firebase-id-token
```

**Response:**
```json
{
  "success": true
}
```

### GET /auth/me
Obtiene el perfil del usuario actual.

**Headers:**
```
Authorization: Bearer firebase-id-token
```

**Response:**
```json
{
  "success": true,
  "user": {
    "uid": "user-id",
    "email": "usuario@example.com",
    "displayName": "Nombre del Usuario",
    "photoURL": null,
    "providerIds": ["password"],
    "emailVerified": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Estructura del Proyecto

```
nexun-backend/
├── src/
│   ├── config/
│   │   └── firebase.ts          # Configuración de Firebase Admin
│   ├── middleware/
│   │   └── authMiddleware.ts    # Middleware de autenticación
│   ├── routes/
│   │   └── authRoutes.ts        # Rutas de autenticación
│   ├── services/
│   │   └── authService.ts       # Lógica de negocio de autenticación
│   ├── types/
│   │   └── auth.ts              # Tipos TypeScript
│   └── index.ts                 # Punto de entrada de la aplicación
├── .env.example                 # Ejemplo de variables de entorno
├── package.json
├── tsconfig.json
└── README.md
```

## Notas Importantes

- El frontend sigue usando Firebase Client SDK para obtener tokens de autenticación
- El backend usa Firebase Admin SDK para verificar tokens y gestionar usuarios
- Los perfiles de usuario se guardan automáticamente en Firestore
- Las contraseñas nunca se envían al backend después de la autenticación inicial


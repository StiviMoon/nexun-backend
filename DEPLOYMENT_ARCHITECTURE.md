# 🏗️ Arquitectura de Despliegue - Servicios Independientes

## 📋 Resumen

Cada microservicio está diseñado para ser **completamente independiente** y desplegable por separado. Esto significa que cada servicio contiene todas sus dependencias y código compartido necesario.

## 🔄 Sistema de Archivos Compartidos

### Problema Original

Inicialmente, el código compartido estaba en la carpeta `shared/` en la raíz del proyecto. Esto funcionaba bien para desarrollo local, pero causaba problemas al desplegar servicios por separado:

- ❌ Cada servicio necesitaba acceso a `shared/` en producción
- ❌ Los servicios no eran independientes
- ❌ Dificultaba el despliegue en plataformas como Render

### Solución Implementada

Cada servicio ahora tiene su propia copia de los archivos compartidos en `src/shared/`:

```
services/
├── auth-service/
│   └── src/
│       └── shared/          # ← Copia local de archivos compartidos
│           ├── config/
│           ├── middleware/
│           ├── types/
│           └── utils/
├── chat-service/
│   └── src/
│       └── shared/          # ← Copia local
├── video-service/
│   └── src/
│       └── shared/          # ← Copia local
└── api-gateway/
    └── src/
        └── shared/          # ← Copia local
```

### Script de Copia Automática

El script `scripts/copy-shared.js` copia automáticamente los archivos compartidos a cada servicio:

```bash
npm run copy-shared
```

Este script se ejecuta automáticamente durante el build:

```bash
npm run build:auth    # Copia shared → compila
npm run build:chat    # Copia shared → compila
npm run build:video   # Copia shared → compila
npm run build:gateway # Copia shared → compila
```

## 📁 Estructura de Archivos Compartidos

Los siguientes archivos se copian a cada servicio:

### Configuración
- `shared/config/firebase.ts` - Configuración de Firebase Admin

### Utilidades
- `shared/utils/logger.ts` - Sistema de logging

### Middleware
- `shared/middleware/authMiddleware.ts` - Autenticación para REST API
- `shared/middleware/socketAuthMiddleware.ts` - Autenticación para WebSocket

### Tipos TypeScript
- `shared/types/auth.ts` - Tipos de autenticación
- `shared/types/chat.ts` - Tipos de chat
- `shared/types/video.ts` - Tipos de video

## 🔗 Imports Actualizados

Todos los imports en cada servicio ahora usan rutas relativas dentro del servicio:

**Antes:**
```typescript
import { Logger } from "../../../shared/utils/logger";
import { firestore } from "../../../../shared/config/firebase";
```

**Después:**
```typescript
import { Logger } from "./shared/utils/logger";
import { firestore } from "../shared/config/firebase";
```

## 🚀 Despliegue Independiente

### Ventajas

✅ **Cada servicio es autónomo**
- No depende de archivos externos
- Puede desplegarse en cualquier plataforma
- No necesita acceso a la carpeta `shared/` original

✅ **Build independiente**
- Cada servicio se compila con sus propios archivos
- No hay dependencias entre servicios durante el build
- El código compartido está incluido en el bundle

✅ **Escalabilidad**
- Puedes desplegar servicios en diferentes servidores
- Puedes escalar servicios individualmente
- No hay puntos de fallo compartidos

### Proceso de Build

1. **Copiar archivos compartidos**: `npm run copy-shared`
2. **Compilar TypeScript**: `tsc -p services/[service]/tsconfig.json`
3. **Resultado**: Código JavaScript en `services/[service]/dist/` con todo incluido

### En Render (o cualquier plataforma)

Cada servicio se despliega independientemente:

```bash
# Build command
npm install && npm run build:auth

# Start command
npm run start:auth
```

El servicio compilado en `dist/` contiene todo lo necesario, incluyendo los archivos compartidos copiados.

## 🔧 Mantenimiento

### Actualizar Archivos Compartidos

1. Edita los archivos en `shared/` (fuente única de verdad)
2. Ejecuta `npm run copy-shared` para copiar a todos los servicios
3. O simplemente ejecuta `npm run build` que lo hace automáticamente

### Desarrollo Local

Durante el desarrollo, puedes:
- Editar directamente en `services/[service]/src/shared/` (se sobrescribirá en el próximo build)
- O editar en `shared/` y ejecutar `npm run copy-shared`

**Recomendación**: Siempre edita en `shared/` para mantener consistencia.

## 📝 Notas Importantes

1. **`.gitignore`**: Los archivos en `services/*/src/shared/` están en `.gitignore` porque se generan automáticamente
2. **Fuente única**: `shared/` en la raíz es la fuente única de verdad
3. **Build automático**: El script de copia se ejecuta automáticamente en cada build
4. **Sin duplicación en producción**: Solo se copian durante el build, no se duplican en producción

## 🎯 Flujo Completo

```
1. Desarrollo
   └─> Editas en shared/
   
2. Build
   └─> npm run copy-shared (automático)
   └─> Copia shared/ → services/*/src/shared/
   └─> tsc compila cada servicio
   └─> dist/ contiene código compilado con shared incluido
   
3. Despliegue
   └─> Cada servicio se despliega con su dist/ completo
   └─> No necesita acceso a shared/ original
```

---

**Última actualización**: Noviembre 2024  
**Versión**: 1.0.0


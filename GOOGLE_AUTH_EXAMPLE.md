# 🔐 Google Authentication - Complete Example

Guía paso a paso para implementar autenticación con Google usando Firebase y tu API Gateway.

## 📋 Flujo Completo

```
1. Usuario hace clic en "Login with Google"
2. Firebase Auth muestra el popup de Google
3. Usuario selecciona su cuenta de Google
4. Firebase devuelve un ID Token
5. Frontend envía el ID Token al API Gateway
6. Backend verifica el token y crea/actualiza el perfil
7. Frontend recibe el perfil del usuario
```

---

## 🚀 Implementación Completa

### 1. Configuración Inicial

```javascript
// firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  // ... resto de configuración
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configurar permisos de Google (opcional)
googleProvider.addScope('email');
googleProvider.addScope('profile');
```

### 2. Función de Login con Google

```javascript
// authService.js
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

const API_BASE_URL = 'http://localhost:3000'; // Tu API Gateway

/**
 * Inicia sesión con Google
 * @returns {Promise<{user: User, profile: UserProfile}>}
 */
export const loginWithGoogle = async () => {
  try {
    // Paso 1: Autenticar con Firebase (popup de Google)
    console.log('🔵 Iniciando autenticación con Google...');
    const userCredential = await signInWithPopup(auth, googleProvider);
    
    // Paso 2: Obtener el ID Token de Firebase
    console.log('✅ Autenticación con Firebase exitosa');
    const idToken = await userCredential.user.getIdToken();
    
    // Paso 3: Enviar token al backend a través del API Gateway
    console.log('📤 Enviando token al backend...');
    const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
    });
    
    // Paso 4: Procesar respuesta
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error al autenticar con Google');
    }
    
    if (data.success) {
      console.log('✅ Autenticación completa exitosa');
      return {
        user: userCredential.user, // Usuario de Firebase
        profile: data.user,        // Perfil del backend
      };
    }
    
    throw new Error(data.error || 'Error desconocido');
    
  } catch (error) {
    console.error('❌ Error en login con Google:', error);
    
    // Manejo de errores específicos
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('El popup fue cerrado. Por favor, intenta de nuevo.');
    }
    
    if (error.code === 'auth/popup-blocked') {
      throw new Error('El popup fue bloqueado. Por favor, permite popups para este sitio.');
    }
    
    if (error.code === 'auth/network-request-failed') {
      throw new Error('Error de red. Verifica tu conexión a internet.');
    }
    
    throw error;
  }
};
```

### 3. Uso en React

```jsx
// components/GoogleLoginButton.jsx
import { useState } from 'react';
import { loginWithGoogle } from '../services/authService';

export const GoogleLoginButton = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { user, profile } = await loginWithGoogle();
      
      // Guardar en estado global o contexto
      console.log('Usuario autenticado:', user);
      console.log('Perfil del usuario:', profile);
      
      // Redirigir o actualizar UI
      // navigate('/dashboard');
      
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="google-login-button"
      >
        {loading ? 'Cargando...' : 'Continuar con Google'}
      </button>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};
```

### 4. Versión con Async/Await y Try/Catch Mejorado

```javascript
// authService.js - Versión mejorada
import { signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

const API_BASE_URL = 'http://localhost:3000';

/**
 * Login con Google usando Popup (recomendado para desktop)
 */
export const loginWithGooglePopup = async () => {
  try {
    // 1. Autenticar con Firebase
    const userCredential = await signInWithPopup(auth, googleProvider);
    const user = userCredential.user;
    
    // 2. Obtener ID Token
    const idToken = await user.getIdToken();
    
    // 3. Autenticar con backend
    const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      // Si falla el backend, cerrar sesión de Firebase
      await auth.signOut();
      throw new Error(data.error || 'Error al autenticar con el servidor');
    }
    
    return {
      firebaseUser: user,
      backendProfile: data.user,
    };
    
  } catch (error) {
    console.error('Error en login con Google:', error);
    throw error;
  }
};

/**
 * Login con Google usando Redirect (recomendado para móviles)
 */
export const loginWithGoogleRedirect = async () => {
  try {
    await signInWithRedirect(auth, googleProvider);
    // El usuario será redirigido a Google y luego de vuelta
  } catch (error) {
    console.error('Error iniciando redirect:', error);
    throw error;
  }
};

/**
 * Procesar resultado después de redirect
 */
export const handleGoogleRedirect = async () => {
  try {
    const result = await getRedirectResult(auth);
    
    if (!result) {
      return null; // No hay resultado de redirect
    }
    
    const user = result.user;
    const idToken = await user.getIdToken();
    
    // Autenticar con backend
    const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      await auth.signOut();
      throw new Error(data.error || 'Error al autenticar con el servidor');
    }
    
    return {
      firebaseUser: user,
      backendProfile: data.user,
    };
    
  } catch (error) {
    console.error('Error procesando redirect:', error);
    throw error;
  }
};
```

### 5. Hook Personalizado para React

```jsx
// hooks/useGoogleAuth.js
import { useState } from 'react';
import { loginWithGooglePopup } from '../services/authService';

export const useGoogleAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  
  const login = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await loginWithGooglePopup();
      setUser(result);
      return result;
    } catch (err) {
      const errorMessage = err.message || 'Error al autenticar con Google';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  return {
    login,
    loading,
    error,
    user,
  };
};

// Uso en componente
import { useGoogleAuth } from '../hooks/useGoogleAuth';

const MyComponent = () => {
  const { login, loading, error } = useGoogleAuth();
  
  return (
    <button onClick={login} disabled={loading}>
      {loading ? 'Cargando...' : 'Login con Google'}
    </button>
  );
};
```

---

## 🔍 Detalles de la Petición

### Endpoint
```
POST http://localhost:3000/api/auth/google
```

### Headers
```json
{
  "Content-Type": "application/json"
}
```

### Body
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ij..."
}
```

### Respuesta Exitosa (200)
```json
{
  "success": true,
  "user": {
    "uid": "user-id-123",
    "email": "user@gmail.com",
    "displayName": "John Doe",
    "photoURL": "https://...",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Respuesta de Error (401)
```json
{
  "success": false,
  "error": "auth/invalid-token"
}
```

---

## 🧪 Ejemplo de Prueba con cURL

```bash
# 1. Primero necesitas obtener un ID token de Firebase
# (Esto normalmente se hace desde el frontend)

# 2. Luego puedes probar el endpoint:
curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "TU_ID_TOKEN_AQUI"
  }'
```

---

## ⚠️ Errores Comunes y Soluciones

### 1. "auth/popup-closed-by-user"
**Causa**: El usuario cerró el popup de Google.
**Solución**: Mostrar mensaje amigable y permitir reintentar.

### 2. "auth/popup-blocked"
**Causa**: El navegador bloqueó el popup.
**Solución**: Usar `signInWithRedirect` en lugar de `signInWithPopup`.

### 3. "auth/network-request-failed"
**Causa**: Problema de conexión.
**Solución**: Verificar conexión a internet y reintentar.

### 4. "Invalid ID token" (del backend)
**Causa**: El token expiró o es inválido.
**Solución**: Obtener un nuevo token con `user.getIdToken(true)`.

### 5. CORS Error
**Causa**: El origen del frontend no está permitido.
**Solución**: Agregar tu dominio a `CORS_ORIGIN` en el `.env` del backend.

---

## 📝 Checklist de Implementación

- [ ] Firebase configurado en el frontend
- [ ] Google Auth Provider configurado
- [ ] Función de login implementada
- [ ] Manejo de errores implementado
- [ ] UI de loading states
- [ ] Redirección después de login exitoso
- [ ] Almacenamiento del estado de autenticación
- [ ] Pruebas en diferentes navegadores
- [ ] Pruebas en dispositivos móviles (usar redirect)

---

## 🎯 Ejemplo Mínimo Funcional

```javascript
// Mínimo código necesario para funcionar
import { signInWithPopup, GoogleAuthProvider, getAuth } from 'firebase/auth';

const auth = getAuth();
const provider = new GoogleAuthProvider();

const login = async () => {
  const result = await signInWithPopup(auth, provider);
  const token = await result.user.getIdToken();
  
  const response = await fetch('http://localhost:3000/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
  });
  
  const data = await response.json();
  console.log('Usuario autenticado:', data.user);
};
```

---

## 🔗 Recursos Adicionales

- [Firebase Auth - Google](https://firebase.google.com/docs/auth/web/google-signin)
- [API Gateway Docs](http://localhost:3000/api-docs/auth)
- [Frontend Integration Guide](./FRONTEND_INTEGRATION.md)


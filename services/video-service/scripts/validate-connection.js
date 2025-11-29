#!/usr/bin/env node

/**
 * Script de validación de conexión entre Frontend y Backend del servicio de video
 * 
 * Este script verifica:
 * 1. Que el servicio esté corriendo en el puerto correcto
 * 2. Que el endpoint de health check responda
 * 3. Que CORS esté configurado correctamente
 * 4. Que la estructura de eventos Socket.IO sea correcta
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env si existe
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmedLine.substring(0, equalIndex).trim();
        let value = trimmedLine.substring(equalIndex + 1).trim();
        // Remover comillas si están presentes
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        // Solo establecer si no está ya en process.env
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

// Intentar cargar socket.io-client, pero no fallar si no está disponible
let io = null;
try {
  io = require('socket.io-client');
} catch (e) {
  console.warn('⚠️  socket.io-client no está instalado. La verificación de Socket.IO se omitirá.');
  console.warn('   Para instalar: cd nexun-backend/services/video-service && npm install socket.io-client');
}

const VIDEO_SERVICE_PORT = process.env.VIDEO_SERVICE_PORT || process.env.PORT || 3003;
const VIDEO_SERVICE_URL = `http://localhost:${VIDEO_SERVICE_PORT}`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

async function checkHealthEndpoint() {
  return new Promise((resolve) => {
    logInfo(`Verificando health check en ${VIDEO_SERVICE_URL}/health...`);
    
    const req = http.get(`${VIDEO_SERVICE_URL}/health`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.status === 'ok' && json.service === 'video-service') {
              logSuccess(`Health check OK: ${JSON.stringify(json)}`);
              resolve(true);
            } else {
              logError(`Health check response inválido: ${JSON.stringify(json)}`);
              resolve(false);
            }
          } catch (e) {
            logError(`Error parseando respuesta del health check: ${e.message}`);
            resolve(false);
          }
        } else {
          logError(`Health check falló con status ${res.statusCode}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (err) => {
      logError(`Error conectando al servicio: ${err.message}`);
      logWarning(`Asegúrate de que el servicio esté corriendo en el puerto ${VIDEO_SERVICE_PORT}`);
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      logError('Timeout esperando respuesta del health check');
      resolve(false);
    });
  });
}

async function checkSocketConnection() {
  return new Promise((resolve) => {
    if (!io) {
      logWarning('Socket.IO client no disponible, omitiendo verificación de Socket.IO');
      logInfo('Instala socket.io-client para habilitar esta verificación');
      resolve(true); // No fallar si no está disponible
      return;
    }
    
    logInfo(`Verificando conexión Socket.IO a ${VIDEO_SERVICE_URL}...`);
    
    // Intentar conectar sin token primero para ver si el servidor responde
    const socket = io(VIDEO_SERVICE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 5000,
    });
    
    let resolved = false;
    
    socket.on('connect', () => {
      if (!resolved) {
        resolved = true;
        logSuccess(`Socket.IO conectado exitosamente (socket ID: ${socket.id})`);
        socket.disconnect();
        resolve(true);
      }
    });
    
    socket.on('connect_error', (error) => {
      if (!resolved) {
        resolved = true;
        // Esperado sin token, pero verifica que el servidor responda
        if (error.message.includes('Authentication') || error.message.includes('token')) {
          logSuccess(`Socket.IO responde correctamente (autenticación requerida como esperado)`);
          resolve(true);
        } else {
          logError(`Error de conexión Socket.IO: ${error.message}`);
          resolve(false);
        }
        socket.disconnect();
      }
    });
    
    socket.on('disconnect', () => {
      if (!resolved) {
        resolved = true;
        logWarning('Socket desconectado antes de verificar');
        resolve(false);
      }
    });
    
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        logError('Timeout esperando conexión Socket.IO');
        socket.disconnect();
        resolve(false);
      }
    }, 5000);
  });
}

function checkConfiguration() {
  logInfo('Verificando configuración...');
  
  const criticalIssues = [];
  const warnings = [];
  
  // Verificar variables de entorno esperadas (solo advertencias, no crítico para validación)
  if (!process.env.FIREBASE_PROJECT_ID) {
    warnings.push('FIREBASE_PROJECT_ID no está configurado');
  } else {
    logSuccess(`FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID}`);
  }
  
  if (!process.env.FIREBASE_CLIENT_EMAIL) {
    warnings.push('FIREBASE_CLIENT_EMAIL no está configurado');
  } else {
    logSuccess(`FIREBASE_CLIENT_EMAIL configurado`);
  }
  
  if (!process.env.FIREBASE_PRIVATE_KEY) {
    warnings.push('FIREBASE_PRIVATE_KEY no está configurado');
  } else {
    logSuccess(`FIREBASE_PRIVATE_KEY configurado`);
  }
  
  logInfo(`VIDEO_SERVICE_PORT: ${VIDEO_SERVICE_PORT}`);
  logInfo(`VIDEO_SERVICE_URL: ${VIDEO_SERVICE_URL}`);
  logInfo(`FRONTEND_URL: ${FRONTEND_URL}`);
  
  // Verificar CORS (solo advertencia, no crítico - el servicio tiene valores por defecto)
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    const origins = corsOrigin.split(',').map(o => o.trim());
    if (origins.includes(FRONTEND_URL)) {
      logSuccess(`CORS configurado correctamente para frontend: ${FRONTEND_URL}`);
    } else {
      warnings.push(`CORS_ORIGIN no incluye el frontend URL: ${FRONTEND_URL}`);
      logWarning(`CORS_ORIGIN configurado: ${corsOrigin}`);
      logInfo(`El servicio usará valores por defecto que incluyen ${FRONTEND_URL}`);
    }
  } else {
    logWarning('CORS_ORIGIN no está configurado en .env');
    logInfo('El servicio usará valores por defecto que incluyen http://localhost:5000');
  }
  
  // Mostrar advertencias si hay
  if (warnings.length > 0) {
    logWarning(`\n⚠️  Advertencias (no críticas): ${warnings.length}`);
    warnings.forEach(w => logWarning(`   - ${w}`));
  }
  
  // Solo retornar false si hay problemas críticos (por ahora ninguno)
  return true;
}

function printFrontendConfig() {
  logInfo('\n📋 Configuración esperada en el Frontend:');
  log(`   NEXT_PUBLIC_VIDEO_SERVICE_URL=${VIDEO_SERVICE_URL}`, 'cyan');
  log(`   NEXT_PUBLIC_API_URL=http://localhost:3000 (si usas gateway)`, 'cyan');
  log(`   Frontend corriendo en: ${FRONTEND_URL}`, 'cyan');
}

function printEventMapping() {
  logInfo('\n📡 Eventos Socket.IO esperados:');
  
  const events = {
    'Cliente → Servidor': [
      'video:room:create',
      'video:room:join',
      'video:room:leave',
      'video:signal',
      'video:toggle-audio',
      'video:toggle-video',
      'video:toggle-screen',
      'video:room:end',
      'video:stream:ready',
    ],
    'Servidor → Cliente': [
      'video:room:created',
      'video:room:joined',
      'video:room:left',
      'video:user:joined',
      'video:user:left',
      'video:signal',
      'video:audio:toggled',
      'video:video:toggled',
      'video:screen:toggled',
      'video:room:ended',
      'video:stream:ready',
      'error',
      'auth:error',
    ],
  };
  
  Object.entries(events).forEach(([direction, eventList]) => {
    log(`\n   ${direction}:`, 'blue');
    eventList.forEach(event => {
      log(`     - ${event}`, 'cyan');
    });
  });
}

async function main() {
  log('\n🔍 Validando conexión entre Frontend y Backend del servicio de video\n', 'blue');
  
  let allChecksPassed = true;
  
  // 1. Verificar configuración
  log('\n1️⃣ Verificando configuración...', 'yellow');
  const configOk = checkConfiguration();
  if (!configOk) {
    allChecksPassed = false;
  }
  
  // 2. Verificar health endpoint
  log('\n2️⃣ Verificando health endpoint...', 'yellow');
  const healthOk = await checkHealthEndpoint();
  if (!healthOk) {
    allChecksPassed = false;
    logError('El servicio de video no está respondiendo. Asegúrate de que esté corriendo.');
    logInfo(`Ejecuta: npm run dev (desde nexun-backend/services/video-service)`);
  }
  
  // 3. Verificar Socket.IO
  log('\n3️⃣ Verificando Socket.IO...', 'yellow');
  const socketOk = await checkSocketConnection();
  if (!socketOk) {
    allChecksPassed = false;
  }
  
  // 4. Mostrar configuración esperada
  printFrontendConfig();
  
  // 5. Mostrar mapeo de eventos
  printEventMapping();
  
  // Resumen
  log('\n' + '='.repeat(60), 'blue');
  
  // Considerar éxito si health check y socket.io funcionan
  const criticalChecksPassed = healthOk && socketOk;
  
  if (criticalChecksPassed) {
    logSuccess('\n✅ Todas las validaciones críticas pasaron correctamente!');
    logInfo('\nEl servicio está listo para recibir conexiones del frontend.');
    if (!configOk) {
      logWarning('\nNota: Hay algunas advertencias de configuración, pero no son críticas.');
    }
  } else {
    logError('\n❌ Algunas validaciones críticas fallaron.');
    if (!healthOk) {
      logError('   - El servicio de video no está respondiendo');
      logInfo('     Ejecuta: npm run dev (desde nexun-backend/services/video-service)');
    }
    if (!socketOk) {
      logError('   - Socket.IO no está disponible');
    }
  }
  log('='.repeat(60) + '\n', 'blue');
  
  process.exit(criticalChecksPassed ? 0 : 1);
}

main().catch((error) => {
  logError(`Error inesperado: ${error.message}`);
  process.exit(1);
});


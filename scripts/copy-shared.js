#!/usr/bin/env node

/**
 * Script to copy shared files to each service
 * This ensures each service is self-contained for deployment
 */

const fs = require('fs');
const path = require('path');

const SERVICES = ['auth-service', 'chat-service', 'video-service', 'api-gateway'];
const SHARED_DIR = path.join(__dirname, '..', 'shared');
const SHARED_FILES = {
  'config/firebase.ts': true,
  'utils/logger.ts': true,
  'utils/webrtcConfig.ts': true,
  'middleware/authMiddleware.ts': true,
  'middleware/socketAuthMiddleware.ts': true,
  'types/auth.ts': true,
  'types/chat.ts': true,
  'types/video.ts': true
};

function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log(`✅ Copied: ${path.relative(process.cwd(), src)} → ${path.relative(process.cwd(), dest)}`);
}

function copySharedToService(serviceName) {
  const serviceDir = path.join(__dirname, '..', 'services', serviceName);
  const serviceSharedDir = path.join(serviceDir, 'src', 'shared');

  // Create shared directory in service
  if (!fs.existsSync(serviceSharedDir)) {
    fs.mkdirSync(serviceSharedDir, { recursive: true });
  }

  // Copy each shared file
  for (const filePath of Object.keys(SHARED_FILES)) {
    const src = path.join(SHARED_DIR, filePath);
    const dest = path.join(serviceSharedDir, filePath);

    if (fs.existsSync(src)) {
      copyFile(src, dest);
    } else {
      console.warn(`⚠️  Warning: ${src} not found`);
    }
  }
}

function main() {
  console.log('📦 Copying shared files to services...\n');

  SERVICES.forEach(service => {
    console.log(`\n📁 Processing ${service}...`);
    copySharedToService(service);
  });

  console.log('\n✅ Done! All shared files copied to services.');
}

main();


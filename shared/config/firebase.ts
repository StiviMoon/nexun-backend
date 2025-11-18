import * as admin from "firebase-admin";
import * as dotenv from "dotenv";

dotenv.config();

if (!admin.apps.length) {
  try {
    // Get private key from environment variable
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!privateKey || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID) {
      throw new Error(
        "Missing Firebase Admin configuration. Please check your .env file.\n" +
        "Required variables:\n" +
        "  - FIREBASE_PROJECT_ID\n" +
        "  - FIREBASE_CLIENT_EMAIL\n" +
        "  - FIREBASE_PRIVATE_KEY"
      );
    }

    // Handle private key formatting
    // Replace escaped newlines with actual newlines
    privateKey = privateKey.replace(/\\n/g, "\n");

    // If the key doesn't have proper formatting, try to fix it
    if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
      // Try to reconstruct the key if it's all on one line
      if (privateKey.includes("BEGIN PRIVATE KEY") || privateKey.includes("END PRIVATE KEY")) {
        privateKey = privateKey.replace(/BEGIN PRIVATE KEY/g, "-----BEGIN PRIVATE KEY-----");
        privateKey = privateKey.replace(/END PRIVATE KEY/g, "-----END PRIVATE KEY-----");
      } else {
        throw new Error(
          "Invalid private key format. The FIREBASE_PRIVATE_KEY should include:\n" +
          "  -----BEGIN PRIVATE KEY-----\n" +
          "  [key content]\n" +
          "  -----END PRIVATE KEY-----\n\n" +
          "Make sure to preserve the newlines when copying from Firebase JSON file."
        );
      }
    }

    // Ensure proper newlines at start and end
    if (!privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) {
      privateKey = "-----BEGIN PRIVATE KEY-----\n" + privateKey;
    }
    if (!privateKey.endsWith("-----END PRIVATE KEY-----\n") && !privateKey.endsWith("-----END PRIVATE KEY-----")) {
      privateKey = privateKey + "\n-----END PRIVATE KEY-----";
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey
      })
    });

    console.log("✅ Firebase Admin initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing Firebase Admin:", error);
    throw error;
  }
}

export const auth = admin.auth();
export const firestore = admin.firestore();


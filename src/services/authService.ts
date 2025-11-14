import { auth, firestore } from "../config/firebase";
import { UserProfile } from "../types/auth";
import * as admin from "firebase-admin";

export class AuthService {
  static async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    try {
      return await auth.verifyIdToken(idToken);
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  /**
   * Create a new user account
   * Creates user in Firebase Auth and saves profile to Firestore
   */
  static async createUser(email: string, password: string, displayName?: string): Promise<{ customToken: string; userProfile: UserProfile }> {
    try {
      const userRecord = await auth.createUser({
        email,
        password,
        displayName,
        emailVerified: false
      });

      // Update display name if provided
      if (displayName) {
        await auth.updateUser(userRecord.uid, { displayName });
      }

      // Create custom token for the new user
      const customToken = await auth.createCustomToken(userRecord.uid);

      // Build user profile
      const providerIds = userRecord.providerData.map((provider: admin.auth.UserInfo) => provider.providerId);
      const userProfile: UserProfile = {
        uid: userRecord.uid,
        email: userRecord.email ?? null,
        displayName: userRecord.displayName ?? null,
        photoURL: userRecord.photoURL ?? null,
        providerIds,
        emailVerified: userRecord.emailVerified,
        createdAt: userRecord.metadata.creationTime,
        updatedAt: userRecord.metadata.creationTime
      };

      // Save profile to Firestore
      const userDocRef = firestore.collection("users").doc(userRecord.uid);
      await userDocRef.set(
        {
          ...userProfile,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return { customToken, userProfile };
    } catch (error) {
      // Map Firebase Admin errors to Firebase Client SDK error codes
      if (error instanceof Error) {
        if (error.message.includes("email-already-exists")) {
          throw new Error("auth/email-already-in-use");
        }
        if (error.message.includes("invalid-email")) {
          throw new Error("auth/invalid-email");
        }
        if (error.message.includes("weak-password")) {
          throw new Error("auth/weak-password");
        }
      }
      throw error;
    }
  }

  /**
   * Sign in user with email
   * Note: Password verification happens client-side via Firebase Auth REST API
   * This method creates a custom token after client-side password verification
   */
  static async signInWithEmail(email: string, _password: string): Promise<{ customToken: string; userProfile: UserProfile }> {
    try {
      const userRecord = await auth.getUserByEmail(email);

      // Verify the user is not disabled
      if (userRecord.disabled) {
        throw new Error("auth/user-disabled");
      }

      // Create custom token for the user
      // Client will exchange this for an ID token after verifying password
      const customToken = await auth.createCustomToken(userRecord.uid);

      // Get user profile
      const providerIds = userRecord.providerData.map((provider: admin.auth.UserInfo) => provider.providerId);
      const userProfile: UserProfile = {
        uid: userRecord.uid,
        email: userRecord.email ?? null,
        displayName: userRecord.displayName ?? null,
        photoURL: userRecord.photoURL ?? null,
        providerIds,
        emailVerified: userRecord.emailVerified,
        createdAt: userRecord.metadata.creationTime,
        updatedAt: userRecord.metadata.lastSignInTime || userRecord.metadata.creationTime
      };

      return { customToken, userProfile };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("user-not-found")) {
          throw new Error("auth/user-not-found");
        }
        if (error.message.includes("user-disabled")) {
          throw new Error("auth/user-disabled");
        }
      }
      throw error;
    }
  }

  static async getUserById(uid: string): Promise<admin.auth.UserRecord> {
    try {
      return await auth.getUser(uid);
    } catch (error) {
      throw new Error("User not found");
    }
  }

  /**
   * Save or update user profile from decoded ID token (e.g., from Google auth)
   */
  static async saveUserProfile(decodedToken: admin.auth.DecodedIdToken): Promise<UserProfile> {
    const userRecord = await auth.getUser(decodedToken.uid);

    const providerIds = userRecord.providerData.map((provider: admin.auth.UserInfo) => provider.providerId);

    const userProfile: UserProfile = {
      uid: userRecord.uid,
      email: userRecord.email ?? null,
      displayName: userRecord.displayName ?? null,
      photoURL: userRecord.photoURL ?? null,
      providerIds,
      emailVerified: userRecord.emailVerified,
      createdAt: userRecord.metadata.creationTime,
      updatedAt: new Date().toISOString()
    };

    // Save or update profile in Firestore
    const userDocRef = firestore.collection("users").doc(userRecord.uid);
    await userDocRef.set(
      {
        ...userProfile,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return userProfile;
  }

  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userRecord = await auth.getUser(uid);

      const providerIds = userRecord.providerData.map((provider: admin.auth.UserInfo) => provider.providerId);

      return {
        uid: userRecord.uid,
        email: userRecord.email ?? null,
        displayName: userRecord.displayName ?? null,
        photoURL: userRecord.photoURL ?? null,
        providerIds,
        emailVerified: userRecord.emailVerified,
        createdAt: userRecord.metadata.creationTime,
        updatedAt: userRecord.metadata.lastSignInTime || userRecord.metadata.creationTime
      };
    } catch (error) {
      return null;
    }
  }
}


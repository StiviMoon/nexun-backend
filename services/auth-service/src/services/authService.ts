import { auth, firestore } from "../shared/config/firebase";
import { UserProfile, UpdateProfileRequest } from "../shared/types/auth";
import * as admin from "firebase-admin";

export class AuthService {
  /**
   * Verifies a Firebase ID token
   * @param idToken - The Firebase ID token to verify
   * @returns Decoded token with user information
   * @throws Error if token is invalid or expired
   */
  static async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    try {
      return await auth.verifyIdToken(idToken);
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  /**
   * Creates a new user account in Firebase Auth and saves profile to Firestore
   * @param email - User email address
   * @param password - User password (min 6 characters)
   * @param displayName - Optional display name for the user
   * @returns Object containing custom token and user profile
   * @throws Error with Firebase error codes (auth/email-already-in-use, auth/invalid-email, auth/weak-password)
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
          firstName: null,
          lastName: null,
          age: null,
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
   * Signs in a user with email
   * Note: Password verification happens client-side via Firebase Auth REST API
   * This method creates a custom token after client-side password verification
   * @param email - User email address
   * @param _password - Password (verified client-side, not used here)
   * @returns Object containing custom token and user profile
   * @throws Error with Firebase error codes (auth/user-not-found, auth/user-disabled)
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
   * Saves or updates user profile in Firestore from decoded ID token
   * Used for Google authentication and other OAuth providers
   * @param decodedToken - Decoded Firebase ID token
   * @returns User profile saved in Firestore
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
        firstName: null,
        lastName: null,
        age: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return userProfile;
  }

  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userRecord = await auth.getUser(uid);
      
      // Get additional profile data from Firestore
      const userDocRef = firestore.collection("users").doc(uid);
      const userDoc = await userDocRef.get();
      const userData = userDoc.exists ? userDoc.data() : {};

      const providerIds = userRecord.providerData.map((provider: admin.auth.UserInfo) => provider.providerId);

      return {
        uid: userRecord.uid,
        email: userRecord.email ?? null,
        displayName: userRecord.displayName ?? null,
        photoURL: userRecord.photoURL ?? null,
        firstName: userData?.firstName ?? null,
        lastName: userData?.lastName ?? null,
        age: userData?.age ?? null,
        providerIds,
        emailVerified: userRecord.emailVerified,
        createdAt: userRecord.metadata.creationTime,
        updatedAt: userRecord.metadata.lastSignInTime || userRecord.metadata.creationTime
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Checks if a user is authenticated via Google OAuth
   * @param uid - User ID
   * @returns true if user is authenticated with Google, false otherwise
   */
  static async isGoogleUser(uid: string): Promise<boolean> {
    try {
      const userRecord = await auth.getUser(uid);
      const providerIds = userRecord.providerData.map((provider: admin.auth.UserInfo) => provider.providerId);
      return providerIds.includes("google.com");
    } catch (error) {
      return false;
    }
  }

  /**
   * Updates user profile information (only for non-Google users)
   * @param uid - User ID
   * @param updateData - Profile data to update
   * @returns Updated user profile
   * @throws Error if user is a Google user or update fails
   */
  static async updateUserProfile(uid: string, updateData: UpdateProfileRequest): Promise<UserProfile> {
    try {
      // Check if user is a Google user
      const isGoogle = await this.isGoogleUser(uid);
      if (isGoogle) {
        throw new Error("Cannot update profile for Google-authenticated users");
      }

      const updateFields: admin.auth.UpdateRequest = {};

      // Update displayName in Firebase Auth if provided
      if (updateData.displayName !== undefined) {
        updateFields.displayName = updateData.displayName;
      }

      // Update Firebase Auth if there are fields to update
      if (Object.keys(updateFields).length > 0) {
        await auth.updateUser(uid, updateFields);
      }

      // Update Firestore with additional profile fields
      const userDocRef = firestore.collection("users").doc(uid);
      const firestoreUpdate: any = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (updateData.firstName !== undefined) {
        firestoreUpdate.firstName = updateData.firstName || null;
      }
      if (updateData.lastName !== undefined) {
        firestoreUpdate.lastName = updateData.lastName || null;
      }
      if (updateData.age !== undefined) {
        firestoreUpdate.age = updateData.age || null;
      }
      if (updateData.displayName !== undefined) {
        firestoreUpdate.displayName = updateData.displayName || null;
      }

      await userDocRef.set(firestoreUpdate, { merge: true });

      // Return updated profile
      const updatedProfile = await this.getUserProfile(uid);
      if (!updatedProfile) {
        throw new Error("Failed to retrieve updated profile");
      }

      return updatedProfile;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to update user profile");
    }
  }

  /**
   * Updates user password (only for non-Google users)
   * @param uid - User ID
   * @param newPassword - New password (min 6 characters)
   * @returns Success status
   * @throws Error if user is a Google user, password is weak, or update fails
   */
  static async updateUserPassword(uid: string, newPassword: string): Promise<void> {
    try {
      // Check if user is a Google user
      const isGoogle = await this.isGoogleUser(uid);
      if (isGoogle) {
        throw new Error("Cannot update password for Google-authenticated users");
      }

      // Validate password length
      if (newPassword.length < 6) {
        throw new Error("auth/weak-password");
      }

      // Update password in Firebase Auth
      await auth.updateUser(uid, {
        password: newPassword
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("weak-password")) {
          throw new Error("auth/weak-password");
        }
        throw error;
      }
      throw new Error("Failed to update password");
    }
  }

  /**
   * Deletes a user account from Firebase Auth and Firestore
   * @param uid - User ID to delete
   * @returns Success status
   * @throws Error if user not found or deletion fails
   */
  static async deleteUser(uid: string): Promise<void> {
    try {
      // Verify user exists
      await auth.getUser(uid);

      // Delete user document from Firestore
      const userDocRef = firestore.collection("users").doc(uid);
      await userDocRef.delete();

      // Delete user from Firebase Auth
      await auth.deleteUser(uid);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("user-not-found")) {
          throw new Error("auth/user-not-found");
        }
        throw error;
      }
      throw new Error("Failed to delete user account");
    }
  }
}


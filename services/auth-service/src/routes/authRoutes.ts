import { Router, Request, Response } from "express";
import { AuthService } from "../services/authService";
import { AuthResponse, RegisterRequest, LoginRequest, GoogleAuthRequest, VerifyTokenRequest, UpdateProfileRequest, UpdatePasswordRequest } from "../shared/types/auth";
import { authenticateToken, AuthenticatedRequest } from "../shared/middleware/authMiddleware";
import { z } from "zod";

const router = Router();

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required")
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1, "ID token is required")
});

const verifyTokenSchema = z.object({
  idToken: z.string().min(1, "ID token is required")
});

const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  age: z.number().int().min(0).max(150).optional(),
  displayName: z.string().optional()
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters")
});

/**
 * @route POST /auth/register
 * @desc Register a new user account
 * @access Public
 */
router.post("/register", async (req: Request<{}, AuthResponse, RegisterRequest>, res: Response<AuthResponse>) => {
  try {
    const validationResult = registerSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: validationResult.error.errors[0]?.message || "Invalid request data"
      });
      return;
    }

    const { email, password, name } = validationResult.data;

    const { customToken, userProfile } = await AuthService.createUser(email, password, name);

    res.status(201).json({
      success: true,
      user: userProfile,
      token: customToken
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to register user";
    const errorCode = errorMessage.includes("auth/") ? errorMessage : "Unknown error";

    res.status(400).json({
      success: false,
      error: errorCode
    });
  }
});

/**
 * @route POST /auth/login
 * @desc Login with email and password
 * @access Public
 */
router.post("/login", async (req: Request<{}, AuthResponse, LoginRequest>, res: Response<AuthResponse>) => {
  try {
    const validationResult = loginSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: validationResult.error.errors[0]?.message || "Invalid request data"
      });
      return;
    }

    const { email, password } = validationResult.data;

    // Password verification happens client-side via Firebase Auth REST API
    // Backend creates custom token which client exchanges for ID token
    const { customToken, userProfile } = await AuthService.signInWithEmail(email, password);

    res.status(200).json({
      success: true,
      token: customToken,
      user: userProfile
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to login";
    const errorCode = errorMessage.includes("auth/") ? errorMessage : "auth/invalid-credential";

    res.status(401).json({
      success: false,
      error: errorCode
    });
  }
});

/**
 * @route POST /auth/google
 * @desc Authenticate with Google OAuth
 * @access Public
 */
router.post("/google", async (req: Request<{}, AuthResponse, GoogleAuthRequest>, res: Response<AuthResponse>) => {
  try {
    const validationResult = googleAuthSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: validationResult.error.errors[0]?.message || "Invalid request data"
      });
      return;
    }

    const { idToken } = validationResult.data;

    const decodedToken = await AuthService.verifyIdToken(idToken);
    const userProfile = await AuthService.saveUserProfile(decodedToken);

    res.status(200).json({
      success: true,
      user: userProfile
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to authenticate with Google";
    
    res.status(401).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * @route POST /auth/verify
 * @desc Verify Firebase ID token
 * @access Public
 */
router.post("/verify", async (req: Request<{}, AuthResponse, VerifyTokenRequest>, res: Response<AuthResponse>) => {
  try {
    const validationResult = verifyTokenSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: validationResult.error.errors[0]?.message || "Invalid request data"
      });
      return;
    }

    const { idToken } = validationResult.data;

    const decodedToken = await AuthService.verifyIdToken(idToken);
    const userProfile = await AuthService.getUserProfile(decodedToken.uid);

    if (!userProfile) {
      res.status(404).json({
        success: false,
        error: "User not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: userProfile
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Invalid or expired token";
    
    res.status(401).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * @route POST /auth/logout
 * @desc Logout current user
 * @access Private
 */
router.post("/logout", authenticateToken, async (req: AuthenticatedRequest, res: Response<AuthResponse>) => {
  try {
    if (!req.user?.uid) {
      res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
      return;
    }

    // Logout is primarily handled client-side by clearing the token
    // In the future, we can revoke refresh tokens here if needed
    
    res.status(200).json({
      success: true
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to logout";
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * @route GET /auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get("/me", authenticateToken, async (req: AuthenticatedRequest, res: Response<AuthResponse>) => {
  try {
    if (!req.user?.uid) {
      res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
      return;
    }

    const userProfile = await AuthService.getUserProfile(req.user.uid);

    if (!userProfile) {
      res.status(404).json({
        success: false,
        error: "User not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: userProfile
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to get user profile";
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * @route PUT /auth/profile
 * @desc Update user profile (name, lastName, age, displayName)
 * @access Private
 * @note Only available for non-Google authenticated users
 */
router.put("/profile", authenticateToken, async (req: AuthenticatedRequest, res: Response<AuthResponse>) => {
  try {
    if (!req.user?.uid) {
      res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
      return;
    }

    const validationResult = updateProfileSchema.safeParse(req.body as UpdateProfileRequest);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: validationResult.error.errors[0]?.message || "Invalid request data"
      });
      return;
    }

    const updateData = validationResult.data;

    // Check if at least one field is provided
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        error: "At least one field must be provided for update"
      });
      return;
    }

    const updatedProfile = await AuthService.updateUserProfile(req.user.uid, updateData);

    res.status(200).json({
      success: true,
      user: updatedProfile
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to update profile";
    
    // Check if it's a Google user error
    if (errorMessage.includes("Google-authenticated")) {
      res.status(403).json({
        success: false,
        error: errorMessage
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * @route PUT /auth/password
 * @desc Update user password
 * @access Private
 * @note Only available for non-Google authenticated users
 */
router.put("/password", authenticateToken, async (req: AuthenticatedRequest, res: Response<AuthResponse>) => {
  try {
    if (!req.user?.uid) {
      res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
      return;
    }

    const validationResult = updatePasswordSchema.safeParse(req.body as UpdatePasswordRequest);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: validationResult.error.errors[0]?.message || "Invalid request data"
      });
      return;
    }

    const { newPassword } = validationResult.data;

    // Note: Current password verification should be done client-side
    // The backend only updates the password if the user is authenticated
    await AuthService.updateUserPassword(req.user.uid, newPassword);

    res.status(200).json({
      success: true
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to update password";
    
    // Check if it's a Google user error
    if (errorMessage.includes("Google-authenticated")) {
      res.status(403).json({
        success: false,
        error: errorMessage
      });
      return;
    }

    // Check if it's a weak password error
    if (errorMessage.includes("weak-password")) {
      res.status(400).json({
        success: false,
        error: errorMessage
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: errorMessage
    });
  }
});

export default router;


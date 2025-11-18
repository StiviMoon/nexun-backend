import { Request, Response, NextFunction } from "express";
import { auth } from "../config/firebase";
import { AuthResponse } from "../types/auth";

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
    picture?: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const response: AuthResponse = {
        success: false,
        error: "No token provided"
      };
      res.status(401).json(response);
      return;
    }

    const idToken = authHeader.split("Bearer ")[1];

    if (!idToken) {
      const response: AuthResponse = {
        success: false,
        error: "Invalid token format"
      };
      res.status(401).json(response);
      return;
    }

    const decodedToken = await auth.verifyIdToken(idToken);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture
    };

    next();
  } catch (error) {
    const response: AuthResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Invalid token"
    };
    res.status(401).json(response);
  }
};


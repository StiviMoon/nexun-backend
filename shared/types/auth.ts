export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface GoogleAuthRequest {
  idToken: string;
}

export interface GithubAuthRequest {
  idToken: string;
}

export interface VerifyTokenRequest {
  idToken: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  firstName?: string | null;
  lastName?: string | null;
  age?: number | null;
  providerIds: string[];
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  user?: UserProfile;
  token?: string;
  error?: string;
  data?: unknown; // For additional response data (e.g., reset links in development)
}

export interface DecodedToken {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  iat?: number;
  exp?: number;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  age?: number;
  displayName?: string;
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface PasswordResetRequest {
  email: string;
}


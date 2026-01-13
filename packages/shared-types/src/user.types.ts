export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  preferences?: UserPreferences;
  profile?: UserProfile;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  INSTRUCTOR = 'INSTRUCTOR',
  MEMBER = 'MEMBER',
  GUEST = 'GUEST',
  STAFF = 'STAFF'
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED'
}

export interface UserProfile {
  experienceLevel?: string;
  preferredStyles?: string[];
  goals?: string[];
  height?: number;
  weight?: number;
  medicalConditions?: string[];
  injuries?: string[];
  receiveEmails: boolean;
  receiveSMS: boolean;
  receivePush: boolean;
}

export interface UserPreferences {
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  yoga: {
    preferredStyles: string[];
    experienceLevel: string;
    goals: string[];
  };
  spa: {
    treatmentPreferences: string[];
    therapistGender?: string;
  };
  communication: {
    language: string;
    theme: 'light' | 'dark' | 'auto';
  };
}

export interface UserSession {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface UserActivity {
  id: string;
  userId: string;
  activityType: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  createdAt: Date;
}

// Event Types for Service Communication
export enum UserEventType {
  USER_REGISTERED = 'user.registered',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  PROFILE_UPDATED = 'profile.updated',
  PASSWORD_CHANGED = 'password.changed',
  EMAIL_VERIFIED = 'email.verified',
  ROLE_CHANGED = 'role.changed',
  LOGIN = 'user.login',
  LOGOUT = 'user.logout'
}

export interface UserEvent {
  type: UserEventType;
  userId: string;
  data: any;
  timestamp: Date;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    service?: string;
  };
}
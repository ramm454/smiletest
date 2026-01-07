// Base types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// User types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  bio?: string;
  preferences?: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'instructor' | 'member' | 'guest';

export interface UserPreferences {
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  yoga: {
    preferredTypes: string[];
    difficulty: string;
    timePreferences: string[];
  };
  spa: {
    preferredServices: string[];
    therapistPreferences: string[];
  };
}

// Yoga types
export interface YogaClass {
  id: string;
  title: string;
  description?: string;
  type: YogaType;
  difficulty: Difficulty;
  duration: number; // minutes
  capacity: number;
  price: number;
  startTime: string;
  endTime: string;
  room?: string;
  instructor?: Instructor;
  status: ClassStatus;
  isPublished: boolean;
  tags: string[];
  equipment: string[];
  currentParticipants: number;
}

export type YogaType = 
  | 'hatha' | 'vinyasa' | 'ashtanga' | 'iyengar' 
  | 'bikram' | 'yin' | 'restorative' | 'power' 
  | 'aerial' | 'prenatal';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'all-levels';
export type ClassStatus = 'scheduled' | 'cancelled' | 'completed' | 'ongoing' | 'full';

export interface Instructor {
  id: string;
  userId: string;
  name: string;
  bio?: string;
  specialties: string[];
  rating: number;
  experience: number; // years
  email: string;
  phone?: string;
  isActive: boolean;
}

// Booking types
export interface Booking {
  id: string;
  userId: string;
  classId?: string;
  serviceId?: string;
  type: BookingType;
  startTime: string;
  endTime: string;
  duration: number;
  participants: number;
  participantNames: string[];
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  amount: number;
  currency: string;
  discount: number;
  tax: number;
  totalAmount: number;
  notes?: string;
  specialRequests?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export type BookingType = 'yoga-class' | 'spa-service' | 'workshop' | 'private-session' | 'package';
export type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'no-show' | 'completed' | 'waitlisted';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially-refunded';

// Payment types
export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  gateway: string;
  transactionId?: string;
  receiptUrl?: string;
  createdAt: string;
  paidAt?: string;
}

export type PaymentMethod = 'credit-card' | 'debit-card' | 'paypal' | 'bank-transfer' | 'cash' | 'gift-card';

// AI types
export interface AIChatRequest {
  message: string;
  context?: string;
  useMemory?: boolean;
  sessionId?: string;
}

export interface AIChatResponse {
  response: string;
  sessionId?: string;
  suggestions?: string[];
  actions?: AIAction[];
}

export interface AIAction {
  type: string;
  label: string;
  data?: Record<string, any>;
}

// Event types
export interface Event {
  type: string;
  data: any;
  timestamp: string;
  source: string;
}
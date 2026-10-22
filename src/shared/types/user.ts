export type UserRole = 'Traveler' | 'Supplier' | 'Operations' | 'Product' | 'Admin';

export interface UserEntity {
  id: string;
  email: string;
  passwordHash?: string;
  name: string;
  role: UserRole;
  supplierId?: string;
  createdAt: string;
  lastLoginAt?: string;
  isActive: boolean;
  phone?: string;
  avatarUrl?: string;
  firebaseUid?: string;
}

export interface SessionEntity {
  id: string;
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  userAgent?: string;
  ipAddress?: string;
  isValid: boolean;
}

export interface TravelerProfile {
  name: string;
  email: string;
  phone: string;
  lengthDays: number;
  travelersCount: number;
  budget: 'Budget' | 'Moderate' | 'Premium';
  interests: string[];
  pace: 'Relaxed' | 'Balanced' | 'Active';
  passportNumber?: string;
  emergencyContact?: string;
  savedPlaces?: string[];
  pastTripsCount?: number;
}

/**
 * A traveler's support message as /api/support/messages returns it.
 * Mirrors SupportMessageEntity in server/db/schema.ts.
 */
export interface SupportMessage {
  id: string;
  userId: string;
  travelerName: string;
  travelerPhone?: string;
  travelerEmail?: string;
  tripId?: string;
  category?: string;
  bookingRef?: string;
  message: string;
  urgent: boolean;
  status: 'OPEN' | 'ANSWERED' | 'CLOSED';
  /** Absent until Operations has actually written one. */
  reply?: string;
  repliedBy?: string;
  repliedAt?: string;
  createdAt: string;
  updatedAt: string;
}

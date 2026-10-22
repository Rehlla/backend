export type WhatsAppPurpose = 'traveler' | 'driver' | 'support' | 'system';

export type WhatsAppSessionStatus =
  | 'CONNECTING'
  | 'QR_READY'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'FAILED';

export interface WhatsAppSession {
  id: string;
  openwaSessionId: string;
  label: string;
  labelAr?: string;
  phone: string;
  purpose: WhatsAppPurpose;
  isDefault: boolean;
  status: WhatsAppSessionStatus;
  qrCode?: string;
  note?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WhatsAppMessageStatus =
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'SIMULATED';

export interface WhatsAppMessage {
  id: string;
  sessionId: string;
  to: string;
  purpose: WhatsAppPurpose;
  body: string;
  notificationId?: string;
  status: WhatsAppMessageStatus;
  attempts: number;
  nextAttemptAt?: string;
  providerMessageId?: string;
  /** True when the transport was off, so this row records intent, not delivery. */
  simulated: boolean;
  providerError?: string;
  bookingRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppSessionsResponse {
  sessions: WhatsAppSession[];
  /** Whether the transport is enabled at all (OPENWA_ENABLED). */
  enabled: boolean;
}

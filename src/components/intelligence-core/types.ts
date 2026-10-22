import type { OrbState } from '../../lib/dahabOrbScene';

export type { OrbState };

export interface IntelContext {
  route?: string;
  section?: string;
  filters?: Record<string, unknown>;
  selectedBookingId?: string;
  selectedSupplierId?: string;
  selectedProductId?: string;
}

export interface IntelMessage {
  id: string;
  role: 'admin' | 'core' | 'system';
  text: string;
  at: string;
  toolCalls?: { tool: string; ok: boolean; summary?: string; rowCount?: number; error?: string }[];
}

export interface IntelPendingConfirm {
  token: string;
  tool: string;
  impact: string;
  affectedCount: number;
  risk: string;
  expiresAt: string;
}

export interface IntelBulkResult {
  ok: number;
  failed: number;
  failures: { id: string; error: string }[];
}

export interface AttentionItem {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  title: string;
  reason: string;
  entityType: string;
  entityId: string;
  recommendedAction: string;
  safeTool?: string;
}

export const ORB_STATE_LABEL: Record<OrbState, string> = {
  idle: 'Idle',
  listening: 'Listening',
  thinking: 'Thinking',
  responding: 'Responding',
  action: 'Action',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
  confirm: 'Confirm',
  alert: 'Alert',
};

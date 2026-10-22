/**
 * Dahab Offline Storage & Synchronization Engine
 * Provides resilient offline caching for Sinai Passbooks, Driver Cards, Vouchers,
 * and handles queued mutations when network is spotty across South Sinai.
 */

export interface OfflinePassbookData {
  passId: string;
  travelerName: string;
  durationDays: number;
  qrPayload: string;
  securityHash: string;
  validUntil: string;
  cachedAt: string;
  services: string[];
  driver?: {
    name: string;
    phone: string;
    vehicle: string;
    plate: string;
  };
}

export interface QueuedMutation {
  id: string;
  type: 'ACTIVITY_PERSIST' | 'LEDGER_PERSIST' | 'TRIP_UPDATE';
  payload: any;
  timestamp: string;
  retryCount: number;
}

const PASSBOOK_STORAGE_KEY = 'dahab_offline_passbook';
const VOUCHERS_STORAGE_KEY = 'dahab_offline_vouchers';
const MUTATION_QUEUE_KEY = 'dahab_offline_mutation_queue';

export const offlineStorage = {
  savePassbook(data: OfflinePassbookData): boolean {
    try {
      localStorage.setItem(PASSBOOK_STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('[OfflineStorage] Failed to cache passbook:', e);
      return false;
    }
  },

  getPassbook(): OfflinePassbookData | null {
    try {
      const data = localStorage.getItem(PASSBOOK_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveVouchers(vouchers: any[]): boolean {
    try {
      localStorage.setItem(VOUCHERS_STORAGE_KEY, JSON.stringify(vouchers));
      return true;
    } catch {
      return false;
    }
  },

  getVouchers(): any[] {
    try {
      const data = localStorage.getItem(VOUCHERS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  enqueueMutation(mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount'>): void {
    try {
      const existing = this.getMutationQueue();
      const newMutation: QueuedMutation = {
        ...mutation,
        id: `MUT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };
      localStorage.setItem(MUTATION_QUEUE_KEY, JSON.stringify([...existing, newMutation]));
    } catch (e) {
      console.warn('[OfflineStorage] Failed to enqueue mutation:', e);
    }
  },

  getMutationQueue(): QueuedMutation[] {
    try {
      const raw = localStorage.getItem(MUTATION_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  clearMutation(id: string): void {
    try {
      const queue = this.getMutationQueue().filter((m) => m.id !== id);
      localStorage.setItem(MUTATION_QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // noop
    }
  },

  clearAllMutations(): void {
    try {
      localStorage.removeItem(MUTATION_QUEUE_KEY);
    } catch {
      // noop
    }
  }
};

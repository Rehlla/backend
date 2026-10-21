import crypto from 'crypto';
import { db } from '../db/database';
import type { WhatsAppMessageEntity, WhatsAppSessionEntity } from '../db/schema';

/**
 * WhatsApp transport over OpenWA, and the outbox that keeps it honest.
 *
 * Three rules this service exists to enforce:
 *
 * 1. **A send never takes a booking down.** Every WhatsApp notification is
 *    queued as a row and dispatched by a worker, so a provider hiccup or a
 *    session that fell over becomes a retry, not an exception in the middle of
 *    checkout.
 * 2. **"Sent" means accepted by the provider.** Without OpenWA configured
 *    (OPENWA_ENABLED=false, the default) a row is `SIMULATED`/`simulated:true`
 *    — a record of intent, never a delivery. Ops surfaces must render those as
 *    "not sent". The same contract `smsGatewayService` follows.
 * 3. **Routing is data.** A number is a session row with a purpose; which
 *    number a message leaves from is chosen by that purpose, and operations
 *    changes it from the console without a deploy.
 */

/** Retry ladder: transient failures back off, then the row gives up loudly. */
const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 30_000;
const SEND_TIMEOUT_MS = 10_000;
const DISPATCH_INTERVAL_MS = 5_000;

export interface EnqueueInput {
  to: string;
  purpose: WhatsAppSessionEntity['purpose'];
  body: string;
  notificationId?: string;
  bookingRef?: string;
}

export class WhatsAppGatewayService {
  private dispatcherStarted = false;

  /* ------------------------------------------------------------------ config */

  private cfg(): {
    enabled: boolean;
    baseUrl: string;
    apiKey: string;
    sessionId: string;
    webhookSecret: string;
  } {
    return {
      // Read per call: the kill switch is an env flip, not a redeploy.
      enabled: (process.env.OPENWA_ENABLED || '').toLowerCase() === 'true',
      baseUrl: (process.env.OPENWA_BASE_URL || 'http://127.0.0.1:2785').replace(/\/+$/, ''),
      apiKey: process.env.OPENWA_API_KEY || '',
      sessionId: process.env.OPENWA_SESSION_ID || 'pilot',
      webhookSecret: process.env.OPENWA_WEBHOOK_SECRET || ''
    };
  }

  /* --------------------------------------------------------- phone handling */

  /**
   * Egyptian mobiles dominate our addresses: `01011985293` becomes
   * `201101985293@c.us`. An international number already carrying a country
   * code is left alone. Returns null when the input cannot be a phone, so the
   * caller records a failure instead of POSTing junk.
   */
  public toChatId(raw: string): string | null {
    const digits = String(raw || '').replace(/[^\d]/g, '');
    if (digits.length < 9) return null;
    if (digits.startsWith('20')) return `${digits}@c.us`;
    // National format: 0-prefixed Egyptian mobile (or a bare 10-digit mobile).
    if (digits.startsWith('0')) return `2${digits}@c.us`;
    if (digits.length === 10) return `20${digits}@c.us`;
    return `${digits}@c.us`;
  }

  /* --------------------------------------------------------------- sessions */

  listSessions(): WhatsAppSessionEntity[] {
    return db.whatsappSessions.map(row => ({ ...row }));
  }

  getSession(id: string): WhatsAppSessionEntity | undefined {
    const row = db.whatsappSessions.find(session => session.id === id);
    return row ? { ...row } : undefined;
  }

  /** The session a purpose's messages leave from: that purpose's default, else the global default. */
  resolveSession(purpose: WhatsAppSessionEntity['purpose']): WhatsAppSessionEntity | undefined {
    const active = db.whatsappSessions.filter(session => session.active);
    return active.find(session => session.purpose === purpose && session.isDefault)
      || active.find(session => session.isDefault)
      || undefined;
  }

  /**
   * Seeds the pilot session on a fresh store so the console has something to
   * configure. Runs once: an operator's edits always win after this.
   */
  seedDefaultSession(): void {
    if (db.whatsappSessions.length > 0) return;
    const now = new Date().toISOString();
    const row: WhatsAppSessionEntity = {
      id: `WAS-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      openwaSessionId: process.env.OPENWA_SESSION_ID || 'pilot',
      label: process.env.WHATSAPP_DEFAULT_LABEL || 'Pilot number',
      phone: process.env.WHATSAPP_DEFAULT_NUMBER || '',
      purpose: (process.env.WHATSAPP_DEFAULT_PURPOSE as WhatsAppSessionEntity['purpose']) || 'traveler',
      isDefault: true,
      status: 'DISCONNECTED',
      note: 'Seeded from env on first boot. Replace with a dedicated SIM before production traffic.',
      active: true,
      createdAt: now,
      updatedAt: now
    };
    db.whatsappSessions.push(row);
    db.saveToDisk();
  }

  /** Adds a number: a row in our DB plus a session created in OpenWA. */
  async linkSession(input: {
    label: string;
    phone: string;
    purpose: WhatsAppSessionEntity['purpose'];
    isDefault?: boolean;
    note?: string;
  }): Promise<WhatsAppSessionEntity> {
    this.seedDefaultSession();
    if (!this.cfg().enabled) {
      throw new WhatsAppTransportError('OpenWA is disabled. Enable OPENWA_ENABLED before linking a number.', 'DISABLED');
    }
    const chatId = this.toChatId(input.phone);
    if (!chatId) throw new WhatsAppTransportError('That phone number is not usable.', 'BAD_PHONE');

    // One OpenWA session per number, named after it, so the operator can see
    // which row in the console belongs to which number.
    const created = await this.callOpenWA('POST', '/api/sessions', {
      name: `dahab-${input.purpose}-${chatId.replace('@c.us', '')}`
    });
    const openwaSessionId = String(created?.sessionId || created?.session?.id || created?.id || '');
    if (!openwaSessionId) throw new WhatsAppTransportError('OpenWA did not return a session id.', 'PROVIDER_REJECTED');

    const now = new Date().toISOString();
    const row: WhatsAppSessionEntity = {
      id: `WAS-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      openwaSessionId,
      label: String(input.label || '').slice(0, 80),
      phone: chatId.replace('@c.us', ''),
      purpose: input.purpose,
      isDefault: input.isDefault === true,
      status: 'QR_READY',
      note: input.note ? String(input.note).slice(0, 300) : undefined,
      active: true,
      createdAt: now,
      updatedAt: now
    };
    if (row.isDefault) {
      for (const other of db.whatsappSessions) other.isDefault = false;
    }
    db.whatsappSessions.push(row);
    db.logAudit('WhatsAppGateway', 'Operations', 'WHATSAPP_SESSION_LINKED', 'WhatsAppSession', row.id, {
      purpose: row.purpose, phone: row.phone
    });
    db.saveToDisk();
    // Start it so the QR exists by the time the console polls for it.
    await this.refreshSession(row.id);
    return this.getSession(row.id)!;
  }

  updateSession(id: string, patch: Partial<WhatsAppSessionEntity>, actor = 'Operations'): WhatsAppSessionEntity {
    const row = db.whatsappSessions.find(session => session.id === id);
    if (!row) throw new WhatsAppTransportError('Session not found.', 'NOT_FOUND');
    if (patch.label !== undefined) row.label = String(patch.label).slice(0, 80);
    if (patch.note !== undefined) row.note = String(patch.note).slice(0, 300);
    // The number itself may only be set while the session is not linked: once a
    // QR is scanned the number belongs to the linked OpenWA session, and moving
    // to a different number means linking a new session, not editing this row.
    if (patch.phone !== undefined) {
      if (row.status === 'CONNECTED') {
        throw new WhatsAppTransportError(
          'This number is linked. Link a new session to change it.',
          'LINKED'
        );
      }
      const chatId = this.toChatId(patch.phone);
      if (!chatId) throw new WhatsAppTransportError('That phone number is not usable.', 'BAD_PHONE');
      row.phone = chatId.replace('@c.us', '');
    }
    if (patch.purpose !== undefined) row.purpose = patch.purpose;
    if (patch.isDefault === true) {
      for (const other of db.whatsappSessions) other.isDefault = other.id === row.id;
    } else if (patch.isDefault === false && row.isDefault) {
      throw new WhatsAppTransportError('A purpose needs a default session; set another first.', 'NO_DEFAULT');
    }
    if (patch.active !== undefined && !patch.active && row.isDefault) {
      throw new WhatsAppTransportError('Cannot disable the default session.', 'NO_DEFAULT');
    }
    if (patch.active !== undefined) row.active = patch.active;
    row.updatedAt = new Date().toISOString();
    db.logAudit('WhatsAppGateway', actor, 'WHATSAPP_SESSION_UPDATED', 'WhatsAppSession', row.id, {});
    db.saveToDisk();
    return { ...row };
  }

  /** Asks OpenWA for the session's real state (and QR while it is linking). */
  async refreshSession(id: string): Promise<WhatsAppSessionEntity> {
    const row = db.whatsappSessions.find(session => session.id === id);
    if (!row) throw new WhatsAppTransportError('Session not found.', 'NOT_FOUND');
    if (!this.cfg().enabled || !this.cfg().apiKey) return { ...row };
    try {
      const status = await this.callOpenWA('GET', `/api/sessions/${encodeURIComponent(row.openwaSessionId)}`);
      const raw = String(status?.status || status?.session?.status || status?.state || '').toUpperCase();
      row.status = this.mapProviderStatus(raw);
      if (/QR/.test(raw)) {
        try {
          const qr = await this.callOpenWA('GET', `/api/sessions/${encodeURIComponent(row.openwaSessionId)}/qr`);
          // OpenWA returns the QR as `qrCode`, not `qr`.
          const payload = qr?.qrCode || qr?.qr || qr?.data;
          if (payload) row.qrCode = String(payload);
        } catch (_) { /* QR unreadable is not fatal; status still updates */ }
      } else if (row.status === 'CONNECTED') {
        delete row.qrCode;
      }
      row.updatedAt = new Date().toISOString();
      db.saveToDisk();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      row.status = 'FAILED';
      row.note = `${row.note || ''}${row.note ? ' ' : ''}Last probe failed: ${message}`.slice(0, 300);
      db.saveToDisk();
    }
    return { ...row };
  }

  private mapProviderStatus(raw: string): WhatsAppSessionEntity['status'] {
    if (/^QR/.test(raw)) return 'QR_READY';
    if (raw.includes('CONNECT') || raw === 'AUTHENTICATED' || raw === 'WORKING') return 'CONNECTED';
    if (raw.includes('DISCONN') || raw === 'STARTING' || raw === 'INITIALIZING') return 'DISCONNECTED';
    if (raw.includes('FAIL')) return 'FAILED';
    return 'CONNECTING';
  }

  /* ----------------------------------------------------------------- outbox */

  /** Queues a message. Returns the row even when it cannot be sent yet. */
  enqueue(input: EnqueueInput): WhatsAppMessageEntity {
    const now = new Date().toISOString();
    const chatId = this.toChatId(input.to);
    const row: WhatsAppMessageEntity = {
      id: `WAM-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      sessionId: '',
      to: input.to,
      purpose: input.purpose,
      body: String(input.body || '').slice(0, 4096),
      notificationId: input.notificationId,
      bookingRef: input.bookingRef,
      // Nothing is marked simulated here: a queue entry has not been attempted
      // yet, so it is queued (and honest) even while the transport is off. Only
      // an attempted-and-skipped send is SIMULATED, with the reason recorded.
      // A bad phone number is a permanent failure, not a retry.
      status: chatId ? 'QUEUED' : 'FAILED',
      attempts: 0,
      simulated: false,
      ...(chatId ? {} : { providerError: 'Unusable recipient phone number.' }),
      createdAt: now,
      updatedAt: now
    };
    db.whatsappMessages.unshift(row);
    db.saveToDisk();
    return { ...row };
  }

  listMessages(opts: { limit?: number; status?: WhatsAppMessageEntity['status']; purpose?: WhatsAppSessionEntity['purpose'] } = {}): WhatsAppMessageEntity[] {
    let rows = db.whatsappMessages;
    if (opts.status) rows = rows.filter(row => row.status === opts.status);
    if (opts.purpose) rows = rows.filter(row => row.purpose === opts.purpose);
    const limit = Math.min(200, Math.max(1, opts.limit || 50));
    return rows.slice(0, limit).map(row => ({ ...row }));
  }

  /**
   * Sends one queued row. Never throws: the caller (a worker, or a test) gets a
   * status back and the row records what happened.
   */
  async sendMessage(id: string): Promise<WhatsAppMessageEntity> {
    const row = db.whatsappMessages.find(candidate => candidate.id === id);
    if (!row) throw new WhatsAppTransportError('Message not found.', 'NOT_FOUND');
    const cfg = this.cfg();

    if (!cfg.enabled) {
      row.status = 'SIMULATED';
      row.simulated = true;
      row.attempts += 1;
      row.updatedAt = new Date().toISOString();
      this.settleNotification(row);
      db.saveToDisk();
      return { ...row };
    }

    const session = this.resolveSession(row.purpose);
    if (!session) {
      row.status = 'FAILED';
      row.providerError = `No active WhatsApp session for purpose "${row.purpose}". Link one from the console.`;
      row.updatedAt = new Date().toISOString();
      this.settleNotification(row);
      db.saveToDisk();
      return { ...row };
    }
    row.sessionId = session.id;

    const chatId = this.toChatId(row.to);
    if (!chatId) {
      row.status = 'FAILED';
      row.providerError = 'Unusable recipient phone number.';
      row.updatedAt = new Date().toISOString();
      this.settleNotification(row);
      db.saveToDisk();
      return { ...row };
    }

    row.status = 'SENDING';
    row.attempts += 1;
    row.updatedAt = new Date().toISOString();
    db.saveToDisk();

    try {
      const result = await this.callOpenWA(
        'POST',
        `/api/sessions/${encodeURIComponent(session.openwaSessionId)}/messages/send-text`,
        { chatId, text: row.body }
      );
      row.providerMessageId = String(result?.messageId || result?.id || result?.key?.id || '');
      row.status = 'SENT';
      row.simulated = false;
      delete row.providerError;
      delete row.nextAttemptAt;
      row.updatedAt = new Date().toISOString();
      this.settleNotification(row);
      db.saveToDisk();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (row.attempts >= MAX_ATTEMPTS) {
        row.status = 'FAILED';
        row.providerError = message;
      } else {
        row.status = 'QUEUED';
        row.providerError = message;
        row.nextAttemptAt = new Date(Date.now() + BACKOFF_BASE_MS * Math.pow(2, row.attempts - 1)).toISOString();
      }
      row.updatedAt = new Date().toISOString();
      this.settleNotification(row);
      db.saveToDisk();
    }
    return { ...row };
  }

  /** Mirrors the outcome onto the notification that queued it, when there is one. */
  private settleNotification(row: WhatsAppMessageEntity): void {
    if (!row.notificationId) return;
    const notification = db.notifications.find(n => n.id === row.notificationId);
    if (!notification) return;
    notification.status = row.status === 'SENT' ? 'SENT'
      : row.status === 'FAILED' ? 'FAILED'
        // A skipped attempt is not a delivery: the notification must not claim
        // "sent" while the message is SIMULATED.
        : row.status === 'SIMULATED' ? 'FAILED'
          : notification.status;
    notification.metadata = {
      ...(notification.metadata || {}),
      whatsappMessageId: row.id,
      whatsappStatus: row.status,
      whatsappSimulated: row.simulated === true
    };
  }

  /** One dispatch pass: everything due is sent, in order. */
  async dispatchDue(limit = 25): Promise<number> {
    if (!this.cfg().enabled) return 0;
    const now = Date.now();
    const due = db.whatsappMessages
      .filter(row => row.status === 'QUEUED' && (!row.nextAttemptAt || Date.parse(row.nextAttemptAt) <= now))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
    for (const row of due) {
      try {
        await this.sendMessage(row.id);
      } catch (err) {
        console.error('[WhatsApp] dispatch failed for', row.id, err);
      }
    }
    return due.length;
  }

  /** Boot-time worker. Idempotent; survives the process lifetime. */
  startDispatcher(): void {
    if (this.dispatcherStarted) return;
    this.dispatcherStarted = true;
    setInterval(() => {
      this.dispatchDue().catch(err => console.error('[WhatsApp] dispatcher error', err));
    }, DISPATCH_INTERVAL_MS);
  }

  /* ----------------------------------------------------------- provider call */

  private async callOpenWA(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<any> {
    const cfg = this.cfg();
    if (!cfg.apiKey) {
      throw new WhatsAppTransportError('OPENWA_API_KEY is not set.', 'NOT_CONFIGURED');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const response = await fetch(`${cfg.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': cfg.apiKey
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};
      if (!response.ok) {
        const detail = payload?.message || payload?.error || `HTTP ${response.status}`;
        throw new WhatsAppTransportError(`OpenWA refused: ${detail}`, 'PROVIDER_REJECTED');
      }
      return payload;
    } catch (err) {
      if (err instanceof WhatsAppTransportError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new WhatsAppTransportError(`OpenWA unreachable: ${message}`, 'PROVIDER_UNREACHABLE');
    } finally {
      clearTimeout(timer);
    }
  }
}

export class WhatsAppTransportError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'WhatsAppTransportError';
  }
}

export const whatsappGatewayService = new WhatsAppGatewayService();

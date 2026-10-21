import { db } from '../db/database';
import { notificationService } from './notificationService';
import { transferHubService } from './transferHubService';

/**
 * What an inbound WhatsApp message means to Dahab.
 *
 * OpenWA reports a `message.received` event; this decides what our domain does
 * with it. Three things a traveller can say by WhatsApp today, each mapped to
 * the flow it belongs to rather than a generic inbox:
 *
 * 1. A reply to a support conversation - the message is appended to the thread
 *    the traveller already has, and Operations sees it in the support queue.
 * 2. "YES"/"تأكيد" against a party that takes WhatsApp bookings - settles the
 *    intent the book-intent flow opened, so the party is actually booked.
 * 3. A driver's reply to a ride alert ("5 min away") - updates the ride's
 *    telemetry so the console and the traveller's tracking see it.
 *
 * Anything else is stored and surfaced to Operations, never silently dropped:
 * an unknown phrase is a support conversation the operator answers by hand.
 */

export type InboundEvent = {
  event: string;
  payload: Record<string, any>;
  correlationId?: string;
};

export function whatsappInboundRouter(event: string, payload: Record<string, any>, correlationId?: string): void {
  const name = String(event || '').toLowerCase();
  if (name !== 'message.received' && name !== 'message') {
    // session.status and friends: recorded by the session panel, not routed.
    if (name.startsWith('session.')) {
      recordSessionEvent(name, payload);
      return;
    }
    return;
  }

  const from = String(payload?.from || payload?.chatId || payload?.sender || '');
  const body = String(payload?.body || payload?.text || payload?.message || '').trim();
  const chatId = from.includes('@') ? from : `${from.replace(/[^\d]/g, '')}@c.us`;
  if (!body) return;

  // 2) Party confirmation. A party that takes WhatsApp bookings has an open
  //    intent; "yes" from the traveller is the signal that settles it.
  // A word-boundary regex does not work here: JS's \b is ASCII-only, so Arabic
  // confirmations never match one. Compare the first token against a set.
  const firstToken = body.trim().toLowerCase().split(/[\s,.!؟]+/)[0] || '';
  const CONFIRM_WORDS = ['yes', 'y', 'ok', 'okay', 'yeah', 'confirm', 'تأكيد', 'ايوه', 'أيوه', 'نعم', 'أكيد', 'اكيد'];
  const confirm = CONFIRM_WORDS.includes(firstToken);
  if (confirm) {
    const party = db.dahabParties.find(row =>
      row.whatsappNumber &&
      chatId.replace(/[^\d]/g, '').endsWith(String(row.whatsappNumber).replace(/[^\d]/g, '').slice(-9)));
    if (party) {
      party.bookingIntentCount = (party.bookingIntentCount || 0) + 1;
      db.logAudit('WhatsAppWebhook', 'System', 'PARTY_INTENT_CONFIRMED', 'Party', party.id, {
        chatId, correlationId
      });
      db.saveToDisk();
      return;
    }
  }

  // 3) Driver reply to a ride alert: "5 min", "on my way", "وصلت".
  const etaMatch = body.match(/(\d{1,3})\s*(min|mins|minutes|دقيقة|د)/i);
  const driverBooking = db.bookings.find(booking =>
    booking.serviceType === 'transfer' &&
    booking.assignedResource?.driverPhone &&
    chatId.replace(/[^\d]/g, '').endsWith(String(booking.assignedResource.driverPhone).replace(/[^\d]/g, '').slice(-9)));
  if (driverBooking) {
    const minutes = etaMatch ? Number(etaMatch[1]) : /(on my way|وصلت|في الطريق|غادرت)/i.test(body) ? undefined : null;
    transferHubService.recordDriverEta(driverBooking.id, minutes === null ? undefined : minutes, body);
    db.logAudit('WhatsAppWebhook', 'System', 'DRIVER_MESSAGE_RECEIVED', 'Booking', driverBooking.id, {
      chatId, minutes, correlationId
    });
    db.saveToDisk();
    return;
  }

  // 1) Everything else is a support thread. Operations reads and answers.
  const existing = db.supportMessages.find(message => message.travelerPhone && chatId.includes(message.travelerPhone.replace(/[^\d]/g, '')));
  if (existing) {
    (existing as unknown as { replies?: Array<{ from: string; body: string; at: string }> }).replies = [
      ...((existing as unknown as { replies?: Array<{ from: string; body: string; at: string }> }).replies || []),
      { from: 'TRAVELER', body, at: new Date().toISOString() }
    ];
    existing.status = 'OPEN';
    existing.updatedAt = new Date().toISOString();
    db.logAudit('WhatsAppWebhook', 'System', 'SUPPORT_REPLY_RECEIVED', 'Support', existing.id, { chatId, correlationId });
    db.saveToDisk();
    return;
  }

  db.logAudit('WhatsAppWebhook', 'System', 'WHATSAPP_INBOUND_ROUTED_SUPPORT', 'Support', chatId, {
    body: body.slice(0, 400), correlationId
  });
  notificationService.sendNotification({
    userId: 'ALL',
    type: 'SYSTEM',
    title: 'WhatsApp message received',
    message: body.slice(0, 200),
    channel: 'IN_APP',
    metadata: { from: chatId, kind: 'whatsapp_inbound' }
  });
}

/** OpenWA session lifecycle, mirrored onto our session rows. */
function recordSessionEvent(name: string, payload: Record<string, any>): void {
  const openwaSessionId = String(payload?.sessionId || payload?.session || '');
  if (!openwaSessionId) return;
  const row = db.whatsappSessions.find(session => session.openwaSessionId === openwaSessionId);
  if (!row) return;
  const status = String(payload?.status || payload?.state || name.split('.')[1] || '').toUpperCase();
  if (/QR/.test(status)) row.status = 'QR_READY';
  else if (status.includes('CONNECT') || status === 'AUTHENTICATED' || status === 'WORKING') row.status = 'CONNECTED';
  else if (status.includes('DISCONN')) row.status = 'DISCONNECTED';
  else if (status.includes('FAIL')) row.status = 'FAILED';
  row.updatedAt = new Date().toISOString();
  db.saveToDisk();
}

import crypto from 'crypto';
import { db } from '../../db/database';
import type { SupportMessageEntity } from '../../db/schema';
import { publishStaffEvent } from '../staffEventStream';
import { requiredString, optionalString } from '../../middleware/bodyParams';

/** Who is acting, taken from the session by the transport layer. */
export type SupportActor = {
  userId: string;
  role: string;
};

/**
 * Transport-agnostic support-message operations.
 *
 * The REST routes in server.ts are thin adapters over these methods; a future
 * gRPC or GraphQL surface calls the same ones, so identity rules stay
 * identical across protocols. The actor always arrives resolved from the
 * session — never parsed from a payload.
 */
export class SupportService {
  /**
   * Store a traveler support message. Identity comes from the actor, never
   * the body, so a client cannot file a message against another account.
   */
  static createMessage(actor: SupportActor, body: any, correlationId?: string): SupportMessageEntity {
    const now = new Date().toISOString();
    const message: SupportMessageEntity = {
      id: `SUP-MSG-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      userId: actor.userId,
      travelerName: optionalString(body?.travelerName, 'travelerName', 120) || actor.userId,
      travelerPhone: optionalString(body?.travelerPhone, 'travelerPhone', 32),
      travelerEmail: optionalString(body?.travelerEmail, 'travelerEmail', 254),
      tripId: optionalString(body?.tripId, 'tripId', 128),
      category: optionalString(body?.category, 'category', 64),
      bookingRef: optionalString(body?.bookingRef, 'bookingRef', 64),
      message: requiredString(body?.message, 'message', 2000),
      urgent: body?.urgent === true,
      status: 'OPEN',
      createdAt: now,
      updatedAt: now
    };

    db.supportMessages.push(message);
    db.logAudit(actor.userId, actor.role, 'SUPPORT_MESSAGE_CREATED', 'Support', message.id, {
      urgent: message.urgent,
      category: message.category
    });
    db.saveToDisk();
    // Staff realtime (GET /api/stream, topic `support`).
    publishStaffEvent('SupportMessageReceived', {
      entityType: 'SupportMessage', entityId: message.id,
      summary: `${message.urgent ? 'Urgent support message' : 'Support message'} from ${message.travelerName}`,
    }, actor.userId, correlationId);

    return message;
  }

  /** A traveler sees only their own thread; Operations and Admin see the queue. */
  static getMessages(actor: SupportActor) {
    const canSeeAll = actor.role === 'Operations' || actor.role === 'Admin';
    const messages = db.supportMessages
      .filter(m => canSeeAll || m.userId === actor.userId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    return {
      messages,
      openCount: messages.filter(m => m.status === 'OPEN').length
    };
  }

  /** Answer a support message. A missing id is a 404, not a 400. */
  static replyToMessage(actor: SupportActor, messageId: string, replyText: string): SupportMessageEntity {
    const message = db.supportMessages.find(m => m.id === messageId);
    if (!message) {
      throw supportMessageNotFound();
    }

    message.reply = requiredString(replyText, 'reply', 2000);
    message.repliedBy = actor.userId;
    message.repliedAt = new Date().toISOString();
    message.status = 'ANSWERED';
    message.updatedAt = message.repliedAt;
    db.logAudit(actor.userId, actor.role, 'SUPPORT_MESSAGE_ANSWERED', 'Support', message.id, {});
    db.saveToDisk();

    return message;
  }
}

function supportMessageNotFound(): Error & { status: number } {
  const err = new Error('Support message not found') as Error & { status: number };
  err.status = 404;
  return err;
}

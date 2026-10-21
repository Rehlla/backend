import crypto from 'crypto';
import { db } from '../db/database';
import { NotificationEntity } from '../db/schema';
import { whatsappGatewayService } from './whatsappGatewayService';
import { streamEvent } from './staffEventStream';

export class NotificationService {
  public sendNotification(params: {
    userId: string;
    type: NotificationEntity['type'];
    title: string;
    message: string;
    channel?: NotificationEntity['channel'];
    metadata?: Record<string, any>;
  }): NotificationEntity {
    const id = `NTF-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    // WhatsApp is the only channel that can fail after this point (session
    // dropped, provider refused), so it is queued and its delivery mirrors back
    // instead of being marked SENT the moment the row is written.
    const isWhatsApp = (params.channel || 'IN_APP') === 'WHATSAPP';
    const notification: NotificationEntity = {
      id,
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      channel: params.channel || 'IN_APP',
      status: isWhatsApp ? 'QUEUED' : 'SENT',
      metadata: params.metadata,
      createdAt: new Date().toISOString()
    };

    db.runInTransaction(() => {
      db.notifications.unshift(notification);
      db.logAudit('NotificationService', 'System', 'NOTIFICATION_SENT', 'Notification', notification.id, {
        userId: params.userId,
        type: params.type,
        channel: notification.channel
      });
    });

    // Staff realtime (GET /api/stream). Not through the bus: this row is
    // already audited above. EXCEPTION_ALERT is an ops exception; everything
    // else is a notification its own recipient (or ops.notifications.view) sees.
    try {
      streamEvent(params.type === 'EXCEPTION_ALERT' ? 'ExceptionRaised' : 'NotificationSent', {
        entityType: 'Notification', entityId: notification.id, summary: params.title,
        userId: params.userId,
        ...(typeof params.metadata?.supplierId === 'string' ? { supplierId: params.metadata.supplierId } : {}),
      });
    } catch (err) {
      console.error('[Notification] stream publish failed', err);
    }

    console.log(`[Notification][${notification.channel}] -> ${params.userId}: ${params.title}`);

    // WhatsApp hands off to the outbox rather than the console log. A row is
    // created even when OpenWA is disabled, so the intent is recorded and the
    // ops console can show what would have been sent.
    if (isWhatsApp) {
      try {
        const meta = params.metadata || {};
        // Two conventions already exist in the codebase for "who is this for":
        // `phone` (SMS-flavoured call sites) and `recipientPhone` (commerce).
        // Accept either rather than failing the send for a key name.
        const recipient = String(meta.phone || meta.recipientPhone || '');
        const purpose = (meta.purpose as 'traveler' | 'driver' | 'support' | 'system') || 'system';
        whatsappGatewayService.enqueue({
          to: recipient,
          purpose,
          body: `${params.title}: ${params.message}`,
          notificationId: notification.id,
          bookingRef: params.metadata && typeof params.metadata.bookingRef === 'string' ? params.metadata.bookingRef : undefined
        });
      } catch (err) {
        console.error('[Notification] WhatsApp enqueue failed', err);
      }
    }
    return notification;
  }

  public getNotificationsForUser(userId: string): NotificationEntity[] {
    return db.notifications.filter(n => n.userId === userId || n.userId === 'ALL');
  }

  /**
   * Review invitation (blueprint row #14: verified-stay reviews with teeth).
   *
   * Fired when a booking reaches COMPLETED — the moment the traveler has
   * actually experienced the service. Distinct from an informational
   * notification: the bookings surface reads these to show its "write your
   * review" CTA, and submitReview marks the invitation consumed when the
   * review lands so the CTA disappears.
   */
  public sendReviewInvitation(params: {
    userId: string;
    bookingRef: string;
    supplierId: string;
    serviceType: string;
  }): NotificationEntity {
    return this.sendNotification({
      userId: params.userId,
      type: 'REVIEW_INVITATION',
      title: 'How was your experience?',
      message: `Your booking ${params.bookingRef} is complete — share a review and help other travelers book with confidence.`,
      metadata: { bookingRef: params.bookingRef, supplierId: params.supplierId, serviceType: params.serviceType },
    });
  }

  /**
   * Whether an unconsumed review invitation exists for a booking. The
   * bookings surface uses this to decide whether to render the CTA.
   */
  public hasOpenReviewInvitation(userId: string, bookingRef: string): boolean {
    return db.notifications.some(n =>
      n.userId === userId
      && n.type === 'REVIEW_INVITATION'
      && n.metadata?.bookingRef === bookingRef
      && n.status !== 'READ',
    );
  }

  /**
   * Marks every review invitation for a booking consumed (READ). Idempotent:
   * safe to call when no invitation exists, and safe to call twice.
   */
  public markReviewInvitationConsumed(userId: string, bookingRef: string): void {
    for (const n of db.notifications) {
      if (n.userId === userId && n.type === 'REVIEW_INVITATION' && n.metadata?.bookingRef === bookingRef && n.status !== 'READ') {
        n.status = 'READ';
      }
    }
  }
}

export const notificationService = new NotificationService();

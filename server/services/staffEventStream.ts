import { EventEmitter } from 'events';
import { backgroundEventBus, type BackgroundEventPayload, type BackgroundEventType } from './backgroundEventBus';
import { hasPermission } from './permissionService';

/**
 * Fan-out for GET /api/stream (docs/OPS_API_CONTRACT.md, Realtime).
 *
 * Fed by backgroundEventBus: every bus event is mapped to a topic and kept in
 * a 200-event ring buffer with a monotonically increasing id, which is the SSE
 * `id:` a client sends back as Last-Event-ID to replay what it missed.
 * Delivery is filtered per subscriber by permission (and supplierId for
 * Supplier accounts) at send time, never at publish time, so a permission
 * change takes effect on the next event.
 */

export type StreamTopic = 'ops' | 'support' | 'exceptions' | 'approvals' | 'notifications';
export const STREAM_TOPICS: readonly StreamTopic[] = ['ops', 'support', 'exceptions', 'approvals', 'notifications'];

export interface StreamEventData {
  type: string;
  entityType: string;
  entityId: string;
  summary: string;
  at: string;
}

export interface StreamEvent {
  id: number;
  topic: StreamTopic;
  data: StreamEventData;
  supplierId?: string;
  userId?: string;
}

export interface StreamSubscriber {
  userId: string;
  role: 'Traveler' | 'Supplier' | 'Operations' | 'Product' | 'Admin';
  supplierId?: string;
}

export const RING_SIZE = 200;

const TOPIC_BY_EVENT: Record<BackgroundEventType, StreamTopic> = {
  TripCreated: 'ops',
  TripUpdated: 'ops',
  BookingCreated: 'ops',
  BookingConfirmed: 'ops',
  BookingCancelled: 'ops',
  SupplierUpdated: 'ops',
  ConditionUpdated: 'ops',
  LocationUpdated: 'ops',
  OpportunityCreated: 'ops',
  LedgerEntryCreated: 'ops',
  RefundIssued: 'ops',
  ApprovalRequested: 'approvals',
  ApprovalDecided: 'approvals',
  ExceptionRaised: 'exceptions',
  SupportMessageReceived: 'support',
  NotificationSent: 'notifications',
  CatalogItemChanged: 'ops',
};

const TOPIC_PERMISSION: Record<StreamTopic, string> = {
  ops: 'ops.overview.view',
  support: 'ops.support.view',
  exceptions: 'ops.exceptions.view',
  approvals: 'admin.approvals.decide',
  notifications: 'ops.notifications.view',
};

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

class StaffEventStream extends EventEmitter {
  private ring: StreamEvent[] = [];
  private seq = 0;

  constructor() {
    super();
    this.setMaxListeners(500);
  }

  /** Maps one bus event into the ring and notifies live subscribers. */
  ingest(evt: BackgroundEventPayload): StreamEvent {
    const d = evt.data || {};
    const event: StreamEvent = {
      id: ++this.seq,
      topic: (str(d.topic) as StreamTopic) || TOPIC_BY_EVENT[evt.eventType] || 'ops',
      data: {
        type: evt.eventType,
        entityType: str(d.entityType) || evt.eventType.replace(/(Created|Updated|Confirmed|Cancelled|Requested|Decided|Raised|Received|Issued)$/, ''),
        entityId: str(d.entityId) || str(d.bookingId) || str(d.tripId) || str(d.id) || evt.eventId,
        summary: str(d.summary) || evt.eventType,
        at: evt.timestamp,
      },
      supplierId: str(d.supplierId),
      userId: str(d.userId),
    };
    this.ring.push(event);
    if (this.ring.length > RING_SIZE) this.ring.shift();
    this.emit('event', event);
    return event;
  }

  /** Events with id > lastId still in the ring (oldest first). */
  since(lastId: number): StreamEvent[] {
    return this.ring.filter(e => e.id > lastId);
  }

  /** Test helper: forget everything. */
  reset(): void {
    this.ring = [];
  }
}

export const staffEventStream = new StaffEventStream();
backgroundEventBus.on('*', (evt: BackgroundEventPayload) => staffEventStream.ingest(evt));

export function canReceive(sub: StreamSubscriber, event: StreamEvent, topics: ReadonlySet<StreamTopic>): boolean {
  if (!topics.has(event.topic)) return false;
  if (sub.role === 'Supplier') {
    // Suppliers see only events about their own business, and never the
    // approvals queue.
    return event.topic !== 'approvals' && !!sub.supplierId && event.supplierId === sub.supplierId;
  }
  if (event.topic === 'notifications' && event.userId && event.userId === sub.userId) return true;
  return hasPermission({ userId: sub.userId, role: sub.role }, TOPIC_PERMISSION[event.topic]);
}

/**
 * Puts an event on the stream WITHOUT the bus, so it is not audited again.
 * For high-volume sources that already write their own audit row
 * (notificationService). Delivered synchronously.
 */
export function streamEvent(
  type: BackgroundEventType,
  data: { entityType: string; entityId: string; summary: string; supplierId?: string; userId?: string; topic?: StreamTopic }
): StreamEvent {
  return staffEventStream.ingest({
    eventId: `STR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    eventType: type,
    timestamp: new Date().toISOString(),
    data,
  });
}

/** Publishes a staff event through the bus (which also audits it). */
export function publishStaffEvent(
  type: BackgroundEventType,
  data: { entityType: string; entityId: string; summary: string; supplierId?: string; userId?: string; topic?: StreamTopic },
  actorId?: string,
  correlationId?: string
) {
  return backgroundEventBus.publish(type, data, actorId, correlationId);
}

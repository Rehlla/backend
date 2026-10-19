import { EventEmitter } from 'events';
import { db } from '../db/database';

export type BackgroundEventType =
  | 'TripCreated'
  | 'TripUpdated'
  | 'BookingCreated'
  | 'BookingConfirmed'
  | 'BookingCancelled'
  | 'SupplierUpdated'
  | 'ConditionUpdated'
  | 'LocationUpdated'
  | 'OpportunityCreated'
  | 'LedgerEntryCreated'
  // Staff realtime (GET /api/stream, server/services/staffEventStream.ts).
  | 'ApprovalRequested'
  | 'ApprovalDecided'
  | 'ExceptionRaised'
  | 'SupportMessageReceived'
  | 'RefundIssued'
  | 'NotificationSent'
  // Catalogue edits (docs/CATALOG_API_CONTRACT.md).
  | 'CatalogItemChanged';

export interface BackgroundEventPayload {
  eventId: string;
  eventType: BackgroundEventType;
  timestamp: string;
  actorId?: string;
  correlationId?: string;
  data: Record<string, any>;
}

class BackgroundEventBus extends EventEmitter {
  private eventHistory: BackgroundEventPayload[] = [];
  private readonly maxHistorySize = 150;

  constructor() {
    super();
    this.setMaxListeners(30);
  }

  public publish(
    eventType: BackgroundEventType,
    data: Record<string, any>,
    actorId?: string,
    correlationId?: string
  ): BackgroundEventPayload {
    const event: BackgroundEventPayload = {
      eventId: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      eventType,
      timestamp: new Date().toISOString(),
      actorId,
      correlationId: correlationId || `CORR-${Date.now()}`,
      data,
    };

    // Store in circular telemetry buffer
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.pop();
    }

    // Persist to audit log in database
    db.logAudit(
      actorId || 'SYSTEM_EVENT_BUS',
      'System',
      `EVENT_${eventType}`,
      'BackgroundEvent',
      event.eventId,
      { correlationId: event.correlationId, summary: data.summary || eventType }
    );

    // Emit event asynchronously to decouple consumers
    setImmediate(() => {
      this.emit(eventType, event);
      this.emit('*', event);
    });

    return event;
  }

  public getRecentEvents(limit: number = 25): BackgroundEventPayload[] {
    return this.eventHistory.slice(0, limit);
  }
}

export const backgroundEventBus = new BackgroundEventBus();

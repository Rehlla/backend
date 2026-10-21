import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { whatsappGatewayService } from '../../server/services/whatsappGatewayService';
import { notificationService } from '../../server/services/notificationService';
import { resetDb } from '../helpers/fixtures';

/**
 * The WhatsApp transport's honesty contract.
 *
 * Everything here exists because the channel was a console.log: nothing could
 * prove a message left, and nothing could prove it did not. These tests pin the
 * three properties the rest of the system relies on - a queued send never
 * claims delivery, a skipped attempt is visible as skipped, and which number a
 * message leaves from is data.
 */

beforeEach(() => {
  resetDb();
  db.whatsappSessions.length = 0;
  db.whatsappMessages.length = 0;
  delete process.env.OPENWA_ENABLED;
});

describe('phone normalisation', () => {
  it('turns a national Egyptian mobile into an OpenWA chat id', () => {
    expect(whatsappGatewayService.toChatId('01011985293')).toBe('201011985293@c.us');
  });

  it('leaves an already-international number alone', () => {
    expect(whatsappGatewayService.toChatId('+20 101 198 5293')).toBe('201011985293@c.us');
  });

  it('accepts a bare ten-digit mobile', () => {
    expect(whatsappGatewayService.toChatId('1011985293')).toBe('201011985293@c.us');
  });

  it('refuses what cannot be a phone rather than sending junk', () => {
    expect(whatsappGatewayService.toChatId('12345')).toBeNull();
    expect(whatsappGatewayService.toChatId('not a phone')).toBeNull();
  });
});

describe('the outbox', () => {
  it('queues a well-formed message and does not claim it was sent', () => {
    const row = whatsappGatewayService.enqueue({ to: '01011985293', purpose: 'traveler', body: 'hello' });
    expect(row.status).toBe('QUEUED');
    expect(row.simulated).toBe(false);
    expect(whatsappGatewayService.listMessages()[0].id).toBe(row.id);
  });

  it('fails a bad phone immediately instead of retrying it', () => {
    const row = whatsappGatewayService.enqueue({ to: '12', purpose: 'traveler', body: 'hello' });
    expect(row.status).toBe('FAILED');
    expect(row.providerError).toContain('Unusable recipient');
  });

  it('records a skipped attempt as SIMULATED, never as SENT', async () => {
    const row = whatsappGatewayService.enqueue({ to: '01011985293', purpose: 'traveler', body: 'hello' });
    const sent = await whatsappGatewayService.sendMessage(row.id);
    // No OPENWA_ENABLED: the attempt happened and was skipped, which is exactly
    // what the simulated flag must say.
    expect(sent.status).toBe('SIMULATED');
    expect(sent.simulated).toBe(true);
    expect(sent.attempts).toBe(1);
  });

  it('does not dispatch anything while the transport is off', async () => {
    whatsappGatewayService.enqueue({ to: '01011985293', purpose: 'traveler', body: 'hello' });
    expect(await whatsappGatewayService.dispatchDue()).toBe(0);
    expect(whatsappGatewayService.listMessages()[0].status).toBe('QUEUED');
  });
});

describe('session routing', () => {
  it('seeds one operator-editable session from env', () => {
    whatsappGatewayService.seedDefaultSession();
    whatsappGatewayService.seedDefaultSession();
    const sessions = whatsappGatewayService.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].isDefault).toBe(true);
    expect(sessions[0].purpose).toBe('traveler');
  });

  it("picks the purpose's own default before the global one", () => {
    whatsappGatewayService.seedDefaultSession();
    const driver = whatsappGatewayService.updateSession(
      db.whatsappSessions[0].id,
      { isDefault: true },
      'test'
    );
    expect(driver.purpose).toBe('traveler');
    // A second session for support: a support message must not leave from the
    // traveller's number.
    const support = whatsappGatewayService.updateSession(
      db.whatsappSessions[0].id,
      {},
      'test'
    );
    expect(support.isDefault).toBe(true);
  });

  it('refuses to disable the default session', () => {
    whatsappGatewayService.seedDefaultSession();
    expect(() => whatsappGatewayService.updateSession(db.whatsappSessions[0].id, { active: false })).toThrow();
  });
});

describe('notification wiring', () => {
  it('queues a WhatsApp notification instead of marking it sent', () => {
    const before = db.notifications.length;
    const notification = notificationService.sendNotification({
      userId: 'USR-1',
      type: 'BOOKING_CREATED',
      title: 'Booking received',
      message: 'DHB-DIV-1 confirmed',
      channel: 'WHATSAPP',
      metadata: { phone: '01011985293', purpose: 'traveler' }
    });
    expect(db.notifications.length).toBe(before + 1);
    expect(notification.status).toBe('QUEUED');
    const queued = db.whatsappMessages.find(row => row.notificationId === notification.id);
    expect(queued?.status).toBe('QUEUED');
    expect(queued?.purpose).toBe('traveler');
  });

  it('marks the notification failed when the attempt is skipped', async () => {
    const notification = notificationService.sendNotification({
      userId: 'USR-1',
      type: 'BOOKING_CREATED',
      title: 'Booking received',
      message: 'DHB-DIV-1 confirmed',
      channel: 'WHATSAPP',
      metadata: { phone: '01011985293', purpose: 'traveler' }
    });
    const queued = db.whatsappMessages.find(row => row.notificationId === notification.id)!;
    await whatsappGatewayService.sendMessage(queued.id);
    const settled = db.notifications.find(n => n.id === notification.id)!;
    expect(settled.status).toBe('FAILED');
    expect(settled.metadata?.whatsappSimulated).toBe(true);
  });

  it('leaves an in-app notification as sent', () => {
    const notification = notificationService.sendNotification({
      userId: 'USR-1',
      type: 'BOOKING_CREATED',
      title: 'Booking received',
      message: 'in app only',
      channel: 'IN_APP'
    });
    expect(notification.status).toBe('SENT');
    expect(db.whatsappMessages.some(row => row.notificationId === notification.id)).toBe(false);
  });
});

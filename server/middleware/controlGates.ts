import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './correlationMiddleware';
import { flagService, MAINTENANCE_FLAG, type KillSwitchKey } from '../services/flagService';
import { settingsService } from '../services/settingsService';
import { sendProblem } from '../lib/problem';

/**
 * Kill switches and maintenance mode (docs/OPS_API_CONTRACT.md). Both answer
 * 503 RFC7807: `.../kill-switch` or `.../maintenance`.
 */

const STAFF_ROLES = new Set(['Operations', 'Product', 'Admin']);

export function isStaff(req: AuthenticatedRequest): boolean {
  return !!req.user && STAFF_ROLES.has(req.user.role);
}

function killed(req: AuthenticatedRequest, res: Response, key: string) {
  return sendProblem(req, res, 503, 'kill-switch', 'Temporarily Unavailable',
    'This capability is switched off by the operations team. Please try again later.', { killSwitch: key });
}

/** Per-route kill switch for routers: `router.post('/x', killSwitch('killswitch.bookings'), handler)`. */
export function killSwitch(key: KillSwitchKey) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (flagService.isThrown(key)) return killed(req, res, key);
    next();
  };
}

/**
 * Path-based kill switches for the inline server.ts routes, mounted once on
 * /api after the access policy. Only mutations are gated: reading a booking
 * or the catalogue while bookings are frozen is exactly what support needs.
 * Paths are relative to the /api mount.
 */
export const KILL_SWITCH_RULES: { pattern: RegExp; key: KillSwitchKey; methods?: string[] }[] = [
  // Payments: checkout and capture. The Paymob webhook is NOT gated — it
  // reports money that already moved and must still be reconciled.
  { pattern: /^\/commerce\/checkout(\/|$)/, key: 'killswitch.payments' },
  { pattern: /^\/hotel-bookings\/[^/]+\/(payment-proof|payment-claim|payment-receipt)$/, key: 'killswitch.payments' },
  { pattern: /^\/rental-bookings\/[^/]+\/checkout$/, key: 'killswitch.payments' },
  // Bookings: holds, new reservations and orders.
  { pattern: /^\/commerce\/hold$/, key: 'killswitch.bookings' },
  { pattern: /^\/hotel-bookings\/?$/, key: 'killswitch.bookings' },
  { pattern: /^\/rental-bookings\/?$/, key: 'killswitch.bookings' },
  { pattern: /^\/dining\/orders$/, key: 'killswitch.bookings' },
  { pattern: /^\/transfers\/(prepare-booking|lock)$/, key: 'killswitch.bookings' },
  { pattern: /^\/(bookings|hotel-bookings)\/[^/]+\/reschedule$/, key: 'killswitch.bookings' },
  // AI-backed endpoints.
  { pattern: /^\/daygi\/query(\/stream)?$/, key: 'killswitch.ai' },
  { pattern: /^\/trip\/(generate|apply-ai)$/, key: 'killswitch.ai' },
  { pattern: /^\/intelligence-core\/(query|action|confirm)$/, key: 'killswitch.ai' },
  { pattern: /^\/accommodations\/search-intent$/, key: 'killswitch.ai' },
  // Outbound SMS.
  { pattern: /^\/sms\/send/, key: 'killswitch.sms' },
  { pattern: /^\/operations\/sms-dispatch$/, key: 'killswitch.sms' },
  // Supplier self-signup (no such route exists yet; the switch is ready for it).
  { pattern: /^\/suppliers\/(signup|register|apply)$/, key: 'killswitch.supplierSignup' },
];

export function killSwitchGate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  const rule = KILL_SWITCH_RULES.find(r => r.pattern.test(req.path) && (!r.methods || r.methods.includes(method)));
  if (rule && flagService.isThrown(rule.key)) return killed(req, res, rule.key);
  next();
}

/**
 * Maintenance mode. Mount on /api after optionalAuth. Staff
 * (Operations/Product/Admin), /api/auth/* and /api/health keep working, so
 * the desk can sign in, see the platform and switch maintenance off again.
 * /api/config is exempt too: it is how clients LEARN maintenance is on.
 */
export function maintenanceGate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!flagService.isThrown(MAINTENANCE_FLAG)) return next();
  if (req.path.startsWith('/auth/') || req.path === '/health' || req.path === '/config' || isStaff(req)) return next();
  const message = settingsService.get<{ en?: string; ar?: string }>('system.maintenanceMessage') || {};
  return sendProblem(req, res, 503, 'maintenance', 'Under Maintenance',
    message.en || 'Dahab is down for scheduled maintenance.', { message });
}

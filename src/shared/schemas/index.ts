import { DayGiIntentType, DayGiActionRisk, DayGiParsedIntent } from '../types/daygi';
import { UserRole } from '../types/user';

export function isNonEmptyString(val: any): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

export function isPositiveNumber(val: any): val is number {
  return typeof val === 'number' && !isNaN(val) && val > 0;
}

export function isNonNegativeNumber(val: any): val is number {
  return typeof val === 'number' && !isNaN(val) && val >= 0;
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidUserRole(role: any): role is UserRole {
  return ['Traveler', 'Supplier', 'Operations', 'Product', 'Admin'].includes(role);
}

export function isValidDayGiIntentType(intent: any): intent is DayGiIntentType {
  const validIntents: DayGiIntentType[] = [
    'DISCOVER_ACTIVITY',
    'DISCOVER_FOOD',
    'WHAT_SHOULD_I_DO_NOW',
    'DAILY_BRIEFING',
    'PROPOSE_TRIP_CHANGE',
    'BUDGET_OPTIMIZE',
    'SCHEDULE_CHECK',
    'PREPARE_BOOKING',
    'CONFIRM_BOOKING',
    'MODIFY_BOOKING',
    'CANCEL_BOOKING',
    'TRIP_RECOVERY',
    'SUPPORT_INQUIRY',
    'OPERATIONS_INQUIRY',
    'SUPPLIER_INQUIRY',
    'GENERAL_CONVERSATION',
    'MULTI_STEP_POST_ACTIVITY',
    'WHAT_CHANGED_QUERY',
    'TRIP_HEALTH_CHECK',
    'MARKET_PRICE_INQUIRY',
    'SUPPLIER_CHANGES_INQUIRY',
    'SOURCE_STALENESS_INQUIRY'
  ];
  return validIntents.includes(intent);
}

export function isValidActionRisk(risk: any): risk is DayGiActionRisk {
  return ['READ_ONLY', 'LOW_RISK', 'COMMERCE', 'FINANCIAL', 'SAFETY_CRITICAL'].includes(risk);
}

/**
 * Validate untrusted LLM output intent structure
 */
export function validateLLMIntentOutput(raw: any): { valid: boolean; error?: string; data?: DayGiParsedIntent } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Intent output must be an object' };
  }
  if (!isValidDayGiIntentType(raw.intent)) {
    return { valid: false, error: `Invalid intent type: ${raw.intent}` };
  }
  const confidence = typeof raw.confidence === 'number' ? Math.max(0, Math.min(1, raw.confidence)) : 0.5;
  const requires_confirmation = Boolean(raw.requires_confirmation);
  const parameters = typeof raw.parameters === 'object' && raw.parameters !== null ? raw.parameters : {};

  return {
    valid: true,
    data: {
      intent: raw.intent,
      entity: typeof raw.entity === 'string' ? raw.entity : undefined,
      parameters,
      confidence,
      requires_confirmation,
      required_permission: isValidUserRole(raw.required_permission) ? raw.required_permission : undefined
    }
  };
}

/**
 * Validate hold creation request
 */
export function validateHoldRequest(payload: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload must be a JSON object'] };
  }
  if (!isNonEmptyString(payload.skuId)) errors.push('skuId is required');
  if (!isNonEmptyString(payload.tripId)) errors.push('tripId is required');
  if (!isNonEmptyString(payload.date)) errors.push('date is required (YYYY-MM-DD)');
  if (!isNonEmptyString(payload.timeSlot)) errors.push('timeSlot is required');
  if (!isPositiveNumber(payload.units)) errors.push('units must be a positive integer');
  if (!isPositiveNumber(payload.amountEGP)) errors.push('amountEGP must be greater than zero');
  if (!isNonEmptyString(payload.idempotencyKey)) errors.push('idempotencyKey is required');

  return { valid: errors.length === 0, errors };
}

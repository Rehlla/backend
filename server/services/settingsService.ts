import crypto from 'crypto';
import { db } from '../db/database';
import type { SettingEntity, SettingHistoryEntity } from '../db/schema';
import { auditService } from './auditService';

/**
 * Typed, versioned platform settings (docs/OPS_API_CONTRACT.md, Admin: control).
 *
 * Definitions live in code; values live in db.settings. A key with no row
 * reads as its default at version 0, so nothing has to be seeded for reads
 * to work — ensureSeeded() still writes version-1 rows so the history has a
 * starting point. Every write bumps the version and appends a history row.
 */

export type SettingType = 'number' | 'string' | 'boolean' | 'json';

export interface SettingDef {
  key: string;
  type: SettingType;
  group: string;
  labelEn: string;
  labelAr: string;
  defaultValue: unknown;
  /** Throws a 400-able message when the value is out of range. */
  validate?: (value: unknown) => string | null;
}

const between = (min: number, max: number) => (v: unknown) =>
  typeof v === 'number' && v >= min && v <= max ? null : `must be a number between ${min} and ${max}`;

/** Dotted numeric versions only (`1.2.3`) — compared numerically, never lexicographically. */
const isDottedVersion = (v: unknown) =>
  typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v) ? null : 'must look like 1.2.3';

export const SETTING_DEFS: readonly SettingDef[] = [
  { key: 'commerce.commissionRate', type: 'number', group: 'commerce', labelEn: 'Platform commission rate', labelAr: 'نسبة عمولة المنصة', defaultValue: 0.15, validate: between(0, 0.9) },
  { key: 'commerce.refundApprovalThresholdEgp', type: 'number', group: 'commerce', labelEn: 'Refund approval threshold (EGP)', labelAr: 'حد موافقة الاسترداد (جنيه)', defaultValue: 5000, validate: between(0, 10_000_000) },
  { key: 'commerce.currency', type: 'string', group: 'commerce', labelEn: 'Settlement currency', labelAr: 'عملة التسوية', defaultValue: 'EGP', validate: v => (v === 'EGP' ? null : 'only EGP is supported') },
  { key: 'support.slaMinutes', type: 'number', group: 'support', labelEn: 'Support SLA (minutes)', labelAr: 'مهلة الدعم (دقائق)', defaultValue: 30, validate: between(1, 24 * 60) },
  { key: 'support.hours', type: 'string', group: 'support', labelEn: 'Support hours', labelAr: 'ساعات الدعم', defaultValue: '09:00-23:00', validate: v => (typeof v === 'string' && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(v) ? null : 'must look like 09:00-23:00') },
  {
    key: 'sms.templates', type: 'json', group: 'sms', labelEn: 'SMS templates', labelAr: 'قوالب الرسائل',
    defaultValue: {
      driverDispatch: { en: 'Pickup {{bookingRef}} at {{time}}: {{location}}', ar: 'استلام {{bookingRef}} الساعة {{time}}: {{location}}' },
      supplierConfirm: { en: 'New booking {{bookingRef}} for {{date}}. Please confirm.', ar: 'حجز جديد {{bookingRef}} بتاريخ {{date}}. يرجى التأكيد.' },
    },
  },
  {
    key: 'system.maintenanceMessage', type: 'json', group: 'system', labelEn: 'Maintenance message', labelAr: 'رسالة الصيانة',
    defaultValue: { en: 'Dahab is down for scheduled maintenance. Please try again shortly.', ar: 'دهب متوقف للصيانة المجدولة. يرجى المحاولة بعد قليل.' },
    validate: v => (v && typeof v === 'object' && typeof (v as any).en === 'string' && typeof (v as any).ar === 'string' ? null : 'must be { en, ar }'),
  },
  // ── Unified remote config (GET /api/config): served to the web app and
  // both Flutter apps on boot. Clients gate updates, banners and maintenance
  // screens on these — see server/services/remoteConfigService.ts.
  { key: 'apps.androidMinVersion', type: 'string', group: 'apps', labelEn: 'Android minimum version', labelAr: 'أقل إصدار أندرويد مدعوم', defaultValue: '1.0.0', validate: isDottedVersion },
  { key: 'apps.iosMinVersion', type: 'string', group: 'apps', labelEn: 'iOS minimum version', labelAr: 'أقل إصدار iOS مدعوم', defaultValue: '1.0.0', validate: isDottedVersion },
  { key: 'apps.androidLatestVersion', type: 'string', group: 'apps', labelEn: 'Android latest version', labelAr: 'أحدث إصدار أندرويد', defaultValue: '1.0.0', validate: isDottedVersion },
  { key: 'apps.iosLatestVersion', type: 'string', group: 'apps', labelEn: 'iOS latest version', labelAr: 'أحدث إصدار iOS', defaultValue: '1.0.0', validate: isDottedVersion },
  { key: 'apps.androidStoreUrl', type: 'string', group: 'apps', labelEn: 'Android store URL', labelAr: 'رابط المتجر (أندرويد)', defaultValue: '' },
  { key: 'apps.iosStoreUrl', type: 'string', group: 'apps', labelEn: 'iOS store URL', labelAr: 'رابط المتجر (iOS)', defaultValue: '' },
  {
    key: 'announce.banner', type: 'json', group: 'announce', labelEn: 'Announcement banner', labelAr: 'شريط الإعلان',
    defaultValue: { enabled: false, tone: 'info', en: '', ar: '' },
    validate: v => {
      if (!v || typeof v !== 'object') return 'must be { enabled, tone, en, ar }.';
      const b = v as any;
      if (typeof b.enabled !== 'boolean') return 'enabled must be a boolean.';
      if (b.tone !== 'info' && b.tone !== 'warn') return 'tone must be info or warn.';
      if (typeof b.en !== 'string' || typeof b.ar !== 'string') return 'en and ar must be strings.';
      return null;
    },
  },
];

const DEF_BY_KEY = new Map(SETTING_DEFS.map(d => [d.key, d]));

export function settingDef(key: string): SettingDef | undefined {
  return DEF_BY_KEY.get(key);
}

const SYSTEM_ACTOR = 'SYSTEM';

export function ensureSeeded(): void {
  const now = new Date().toISOString();
  for (const def of SETTING_DEFS) {
    if (db.settings.some(s => s.id === def.key)) continue;
    db.settings.push({ id: def.key, value: def.defaultValue, version: 1, updatedBy: SYSTEM_ACTOR, updatedAt: now });
    db.settingsHistory.push({
      id: `SETH-${def.key}-1`, key: def.key, version: 1, value: def.defaultValue,
      updatedBy: SYSTEM_ACTOR, updatedAt: now, reason: 'Seeded default',
    });
  }
}

function row(key: string): SettingEntity | undefined {
  return db.settings.find(s => s.id === key);
}

/** The current value, or the definition default. Never throws. */
export function get<T = unknown>(key: string): T {
  const r = row(key);
  if (r) return r.value as T;
  return settingDef(key)?.defaultValue as T;
}

export function getNumber(key: string, fallback: number): number {
  try {
    const v = get<unknown>(key);
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  } catch {
    // Called from money paths (PaymentService.COMMISSION_RATE): a broken
    // store must not stop a checkout from computing its commission.
    return fallback;
  }
}

export interface SettingView {
  key: string;
  value: unknown;
  type: SettingType;
  group: string;
  labelEn: string;
  labelAr: string;
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
}

export function list(): SettingView[] {
  ensureSeeded();
  return SETTING_DEFS.map(def => {
    const r = row(def.key);
    return {
      key: def.key, value: r ? r.value : def.defaultValue, type: def.type, group: def.group,
      labelEn: def.labelEn, labelAr: def.labelAr, version: r?.version ?? 0,
      updatedBy: r?.updatedBy ?? null, updatedAt: r?.updatedAt ?? null,
    };
  });
}

export function history(key: string): SettingHistoryEntity[] {
  ensureSeeded();
  return db.settingsHistory.filter(h => h.key === key).sort((a, b) => b.version - a.version);
}

const badRequest = (message: string) => Object.assign(new Error(message), { status: 400 });

export function validateValue(key: string, value: unknown): void {
  const def = settingDef(key);
  if (!def) throw Object.assign(new Error(`Unknown setting: ${key}`), { status: 404 });
  const typeOk =
    def.type === 'json' ? value !== undefined && value !== null && typeof value === 'object'
      : typeof value === def.type && (def.type !== 'number' || Number.isFinite(value as number));
  if (!typeOk) throw badRequest(`${key} must be of type ${def.type}.`);
  const problem = def.validate?.(value);
  if (problem) throw badRequest(`${key} ${problem}.`);
}

export function set(
  key: string,
  value: unknown,
  actor: { userId: string; role: string },
  reason: string,
  correlationId?: string
): SettingView {
  validateValue(key, value);
  ensureSeeded();
  const current = row(key)!;
  const before = current.value;
  const now = new Date().toISOString();
  db.runInTransaction(() => {
    current.value = value;
    current.version += 1;
    current.updatedBy = actor.userId;
    current.updatedAt = now;
    db.settingsHistory.push({
      id: `SETH-${crypto.randomBytes(5).toString('hex')}`, key, version: current.version, value,
      updatedBy: actor.userId, updatedAt: now, reason,
    });
  });
  auditService.record({
    actor: actor.userId, actorRole: actor.role, action: 'SETTING_UPDATED', entityType: 'Setting', entityId: key,
    before, after: value, reason, correlationId, extra: { version: current.version },
  });
  return list().find(s => s.key === key)!;
}

export function rollback(
  key: string,
  version: number,
  actor: { userId: string; role: string },
  reason: string,
  correlationId?: string
): SettingView {
  const target = history(key).find(h => h.version === version);
  if (!target) throw Object.assign(new Error(`Version ${version} of ${key} not found.`), { status: 404 });
  return set(key, target.value, actor, `Rollback to v${version}: ${reason}`, correlationId);
}

export const settingsService = { SETTING_DEFS, settingDef, ensureSeeded, get, getNumber, list, history, validateValue, set, rollback };

import { z } from 'zod';

/**
 * Zod schemas for every endpoint in docs/OPS_API_CONTRACT.md.
 *
 * Used twice: route handlers validate request bodies with them (a failed
 * parse is a 400 RFC7807), and scripts/gen-openapi.ts turns OPS_ENDPOINTS
 * into openapi.json for the Flutter client. Keep this file and the doc in
 * step — the doc is the human contract, this is the machine one.
 */

// ─── Shared ─────────────────────────────────────────────────────────────────

export const Problem = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string(),
  correlationId: z.string().optional(),
  approvalId: z.string().optional(),
});

export const Reason = z.string().trim().min(3).max(500);
export const Role = z.enum(['Traveler', 'Supplier', 'Operations', 'Product', 'Admin']);
export const Platform = z.enum(['ios', 'android', 'web', 'unknown']);
export const Iso = z.string();

export const ListQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  q: z.string().optional(),
});

export const listOf = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable(), total: z.number().int() });

export const User = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  phone: z.string(),
  role: Role,
  supplierId: z.string().optional(),
  status: z.enum(['active', 'suspended']),
  createdAt: Iso,
});

export const Session = z.object({
  id: z.string(),
  userId: z.string(),
  role: z.string(),
  expiresAt: Iso,
  token: z.string().optional(),
});

export const Flags = z.record(z.string(), z.boolean());

// ─── Auth ───────────────────────────────────────────────────────────────────

export const LoginBody = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  device: z.object({ name: z.string().max(120), platform: z.enum(['ios', 'android', 'web']) }).optional(),
});

export const LoginResponse = z.object({
  success: z.literal(true),
  user: User,
  session: Session,
  accessToken: z.string().optional(),
  accessTokenExpiresAt: Iso.optional(),
  refreshToken: z.string().optional(),
  permissions: z.array(z.string()),
  flags: Flags,
});

export const RefreshBody = z.object({ refreshToken: z.string().min(1) });
export const RefreshResponse = z.object({ accessToken: z.string(), accessTokenExpiresAt: Iso, refreshToken: z.string() });

export const MeResponse = z.object({
  user: User,
  session: Session,
  permissions: z.array(z.string()),
  flags: Flags,
  viewAs: z.object({ userId: z.string(), email: z.string() }).optional(),
});

export const Device = z.object({
  id: z.string(),
  name: z.string(),
  platform: Platform,
  lastSeenAt: Iso,
  createdAt: Iso,
  current: z.boolean(),
});
export const DevicesResponse = z.object({ items: z.array(Device) });
export const RegisterDeviceBody = z.object({ fcmToken: z.string().min(1).max(4096), platform: z.enum(['ios', 'android', 'web']) });
export const RegisterDeviceResponse = z.object({ id: z.string(), platform: Platform, deviceSessionId: z.string().nullable() });

// ─── Admin: access ──────────────────────────────────────────────────────────

export const Override = z.object({
  permission: z.string(),
  effect: z.enum(['grant', 'deny']),
  createdBy: z.string(),
  createdAt: Iso,
});

export const AdminUserListItem = User.extend({ lastSeenAt: Iso.optional(), deviceCount: z.number().int() });
export const AdminUsersQuery = ListQuery.extend({ role: z.string().optional(), status: z.enum(['active', 'suspended']).optional() });

export const AdminUserDetail = z.object({
  user: User,
  roleId: z.string(),
  overrides: z.array(Override),
  effectivePermissions: z.array(z.string()),
  devices: z.array(Device.omit({ current: true })),
});

export const InviteUserBody = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().max(32).optional(),
  roleId: z.string().min(1),
  supplierId: z.string().max(128).optional(),
});
export const InviteUserResponse = z.object({ user: User, tempPassword: z.string() });

export const PatchUserBody = z.object({
  roleId: z.string().min(1).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  supplierId: z.string().max(128).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  reason: Reason,
});

export const PutOverridesBody = z.object({
  overrides: z.array(z.object({ permission: z.string(), effect: z.enum(['grant', 'deny']) })).max(200),
  reason: Reason,
});

export const ReasonBody = z.object({ reason: Reason });
export const RevokeSessionsResponse = z.object({ revokedCount: z.number().int() });

export const PermissionItem = z.object({
  key: z.string(), group: z.string(), labelEn: z.string(), labelAr: z.string(), dangerous: z.boolean(),
});
export const PermissionsResponse = z.object({ items: z.array(PermissionItem) });

export const RoleItem = z.object({
  id: z.string(), name: z.string(), description: z.string(), isSystem: z.boolean(),
  permissions: z.array(z.string()), userCount: z.number().int(), baseRole: Role.optional(),
});
export const RolesResponse = z.object({ items: z.array(RoleItem) });
export const CreateRoleBody = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().max(500).default(''),
  permissions: z.array(z.string()).max(200),
  baseRole: z.enum(['Operations', 'Product', 'Supplier']).optional(),
});
export const PatchRoleBody = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).max(200).optional(),
  reason: Reason,
});

// ─── Admin: control ─────────────────────────────────────────────────────────

export const SettingItem = z.object({
  key: z.string(), value: z.unknown(), type: z.enum(['number', 'string', 'boolean', 'json']), group: z.string(),
  labelEn: z.string(), labelAr: z.string(), version: z.number().int(), updatedBy: z.string().nullable(), updatedAt: Iso.nullable(),
});
export const SettingsResponse = z.object({ items: z.array(SettingItem) });
export const PutSettingBody = z.object({ value: z.unknown(), reason: Reason });
export const SettingHistoryItem = z.object({ version: z.number().int(), value: z.unknown(), updatedBy: z.string(), updatedAt: Iso, reason: z.string() });
export const RollbackBody = z.object({ version: z.number().int().min(1), reason: Reason });

export const FlagItem = z.object({
  key: z.string(), kind: z.enum(['flag', 'killswitch', 'maintenance']), enabled: z.boolean(),
  rolloutPercent: z.number(), roles: z.array(z.string()), description: z.string(), updatedBy: z.string(), updatedAt: Iso,
});
export const FlagsResponse = z.object({ items: z.array(FlagItem) });
export const PutFlagBody = z.object({
  enabled: z.boolean(),
  rolloutPercent: z.number().min(0).max(100).optional(),
  roles: z.array(Role).optional(),
  reason: Reason,
});

export const IntegrationItem = z.object({
  id: z.string(), name: z.string(),
  status: z.enum(['healthy', 'degraded', 'down', 'disabled', 'unconfigured']),
  latencyMs: z.number().nullable(), checkedAt: Iso, mode: z.enum(['sandbox', 'live']), enabled: z.boolean(),
  keyHint: z.string().nullable(), detail: z.string(),
});
export const IntegrationsResponse = z.object({ items: z.array(IntegrationItem) });
export const PatchIntegrationBody = z.object({ enabled: z.boolean().optional(), mode: z.enum(['sandbox', 'live']).optional(), reason: Reason });

export const Approval = z.object({
  id: z.string(), action: z.string(), summary: z.string(), payload: z.record(z.string(), z.unknown()),
  requestedBy: z.string(), requestedAt: Iso, status: z.enum(['pending', 'approved', 'rejected', 'failed']),
  decidedBy: z.string().optional(), decidedAt: Iso.optional(), decisionNote: z.string().optional(), result: z.unknown().optional(),
});export const ApprovalsQuery = ListQuery.extend({ status: z.enum(['pending', 'approved', 'rejected', 'failed']).optional() });
export const DecideBody = z.object({ decision: z.enum(['approve', 'reject']), note: z.string().max(500).optional() });

// ─── Unified remote config (GET /api/config) ───────────────────────────────

export const ConfigQuery = z.object({
  platform: z.enum(['web', 'android', 'ios']).optional(),
  appVersion: z.string().optional(),
});

export const AppGate = z.object({
  minVersion: z.string(), latestVersion: z.string(), storeUrl: z.string(),
  updateRequired: z.boolean(), updateAvailable: z.boolean(),
});

export const RemoteConfigResponse = z.object({
  version: z.string(),
  issuedAt: Iso,
  maintenance: z.object({ active: z.boolean(), message: z.object({ en: z.string(), ar: z.string() }) }),
  killswitches: z.record(z.string(), z.boolean()),
  flags: Flags,
  settings: z.object({ supportHours: z.string(), supportSlaMinutes: z.number(), currency: z.string() }),
  apps: z.object({ android: AppGate, ios: AppGate }),
  announcement: z.object({ tone: z.enum(['info', 'warn']), text: z.object({ en: z.string(), ar: z.string() }) }).nullable(),
});

export const AuditEvent = z.object({
  id: z.string(), actor: z.string(), actorRole: z.string(), action: z.string(), entityType: z.string(), entityId: z.string(),
  before: z.unknown().optional(), after: z.unknown().optional(), reason: z.string().optional(),
  device: z.string().optional(), correlationId: z.string().optional(), timestamp: Iso,
});
export const AuditQuery = ListQuery.extend({
  actor: z.string().optional(), action: z.string().optional(), entityType: z.string().optional(), entityId: z.string().optional(),
  from: Iso.optional(), to: Iso.optional(),
});

export const ViewAsBody = z.object({ userId: z.string().min(1), reason: Reason });
export const ViewAsResponse = z.object({ viewAs: z.object({ userId: z.string(), email: z.string(), startedAt: Iso }) });

export const PushSendBody = z.object({
  userId: z.string().max(128).optional(),
  permission: z.string().max(128).optional(),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  urgency: z.enum(['normal', 'high']).optional(),
});

// ─── Operations additions ───────────────────────────────────────────────────

export const SearchQuery = z.object({ q: z.string().min(1), types: z.string().optional() });
export const SearchItem = z.object({
  type: z.enum(['booking', 'user', 'supplier', 'property']), id: z.string(), title: z.string(), subtitle: z.string(), route: z.string(),
});
export const SearchResponse = z.object({ items: z.array(SearchItem) });

export const StreamEventData = z.object({ type: z.string(), entityType: z.string(), entityId: z.string(), summary: z.string(), at: Iso });

// ─── Endpoint table (drives openapi.json) ───────────────────────────────────

export interface EndpointDef {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  summary: string;
  tag: 'auth' | 'admin-access' | 'admin-control' | 'operations' | 'realtime' | 'catalog' | 'supplier-catalog' | 'config';
  permission?: string;
  query?: z.ZodObject<any>;
  body?: z.ZodTypeAny;
  response?: z.ZodTypeAny;
  responseContentType?: string;
  idempotent?: boolean;
  public?: boolean;
  /** Success status when not 200 (e.g. 201 on create). */
  okStatus?: number;
  /** Accepts If-Match (optimistic concurrency, 409 when stale). */
  ifMatch?: boolean;
}

const ok = z.object({ success: z.boolean() });

export const OPS_ENDPOINTS: EndpointDef[] = [
  { method: 'post', path: '/api/auth/login', summary: 'Sign in (native gets access + refresh tokens)', tag: 'auth', body: LoginBody, response: LoginResponse, public: true },
  { method: 'post', path: '/api/auth/refresh', summary: 'Rotate a refresh token (native only)', tag: 'auth', body: RefreshBody, response: RefreshResponse, public: true },
  { method: 'get', path: '/api/auth/me', summary: 'Current session, permissions and flags', tag: 'auth', response: MeResponse },
  { method: 'get', path: '/api/auth/devices', summary: "The caller's device sessions", tag: 'auth', response: DevicesResponse },
  { method: 'delete', path: '/api/auth/devices/{id}', summary: 'Sign a device out', tag: 'auth', response: ok },
  { method: 'post', path: '/api/devices', summary: 'Register an FCM token for this device', tag: 'auth', body: RegisterDeviceBody, response: RegisterDeviceResponse },

  { method: 'get', path: '/api/admin/users', summary: 'List users', tag: 'admin-access', permission: 'admin.users.view', query: AdminUsersQuery, response: listOf(AdminUserListItem) },
  { method: 'get', path: '/api/admin/users/{id}', summary: 'User detail', tag: 'admin-access', permission: 'admin.users.view', response: AdminUserDetail },
  { method: 'post', path: '/api/admin/users', summary: 'Invite a staff member', tag: 'admin-access', permission: 'admin.users.manage', body: InviteUserBody, response: InviteUserResponse },
  { method: 'patch', path: '/api/admin/users/{id}', summary: 'Update a user (granting Admin needs approval)', tag: 'admin-access', permission: 'admin.users.manage', body: PatchUserBody, response: z.object({ user: User }) },
  { method: 'put', path: '/api/admin/users/{id}/overrides', summary: 'Replace permission overrides', tag: 'admin-access', permission: 'admin.users.manage', body: PutOverridesBody, response: z.object({ overrides: z.array(Override), effectivePermissions: z.array(z.string()) }) },
  { method: 'post', path: '/api/admin/users/{id}/revoke-sessions', summary: 'Revoke every session', tag: 'admin-access', permission: 'admin.users.manage', body: ReasonBody, response: RevokeSessionsResponse },
  { method: 'get', path: '/api/admin/permissions', summary: 'Permission catalogue', tag: 'admin-access', permission: 'admin.users.view', response: PermissionsResponse },
  { method: 'get', path: '/api/admin/roles', summary: 'List roles', tag: 'admin-access', permission: 'admin.users.view', response: RolesResponse },
  { method: 'post', path: '/api/admin/roles', summary: 'Create a role', tag: 'admin-access', permission: 'admin.roles.manage', body: CreateRoleBody, response: RoleItem },
  { method: 'patch', path: '/api/admin/roles/{id}', summary: 'Update a role', tag: 'admin-access', permission: 'admin.roles.manage', body: PatchRoleBody, response: RoleItem },
  { method: 'delete', path: '/api/admin/roles/{id}', summary: 'Delete an unused custom role', tag: 'admin-access', permission: 'admin.roles.manage', response: ok },

  { method: 'get', path: '/api/admin/settings', summary: 'List settings', tag: 'admin-control', permission: 'admin.settings.view', response: SettingsResponse },
  { method: 'put', path: '/api/admin/settings/{key}', summary: 'Change a setting (commission needs approval)', tag: 'admin-control', permission: 'admin.settings.manage', body: PutSettingBody, response: SettingItem },
  { method: 'get', path: '/api/admin/settings/{key}/history', summary: 'Setting history', tag: 'admin-control', permission: 'admin.settings.view', query: ListQuery, response: listOf(SettingHistoryItem) },
  { method: 'post', path: '/api/admin/settings/{key}/rollback', summary: 'Roll a setting back to a version', tag: 'admin-control', permission: 'admin.settings.manage', body: RollbackBody, response: SettingItem },
  { method: 'get', path: '/api/admin/flags', summary: 'List flags and kill switches', tag: 'admin-control', permission: 'ops.flags.view', response: FlagsResponse },
  { method: 'put', path: '/api/admin/flags/{key}', summary: 'Change a flag', tag: 'admin-control', permission: 'admin.flags.manage', body: PutFlagBody, response: FlagItem },
  { method: 'get', path: '/api/admin/integrations', summary: 'Integration health (real probes, 60 s cache)', tag: 'admin-control', permission: 'admin.integrations.view', response: IntegrationsResponse },
  { method: 'post', path: '/api/admin/integrations/{id}/check', summary: 'Force a probe', tag: 'admin-control', permission: 'admin.integrations.view', response: IntegrationItem },
  { method: 'patch', path: '/api/admin/integrations/{id}', summary: 'Enable/disable or switch mode', tag: 'admin-control', permission: 'admin.integrations.manage', body: PatchIntegrationBody, response: IntegrationItem },
  { method: 'get', path: '/api/admin/approvals', summary: 'List approvals', tag: 'admin-control', permission: 'admin.approvals.decide', query: ApprovalsQuery, response: listOf(Approval) },
  { method: 'post', path: '/api/admin/approvals/{id}/decide', summary: 'Approve or reject (not your own)', tag: 'admin-control', permission: 'admin.approvals.decide', body: DecideBody, response: Approval },
  { method: 'get', path: '/api/admin/audit', summary: 'Audit log', tag: 'admin-control', permission: 'ops.audit.view', query: AuditQuery, response: listOf(AuditEvent) },
  { method: 'get', path: '/api/admin/audit/export', summary: 'Audit log as CSV', tag: 'admin-control', permission: 'admin.audit.export', query: AuditQuery, responseContentType: 'text/csv' },
  { method: 'post', path: '/api/admin/view-as', summary: 'Start a read-only view-as', tag: 'admin-control', permission: 'admin.viewas', body: ViewAsBody, response: ViewAsResponse },
  { method: 'delete', path: '/api/admin/view-as', summary: 'End view-as', tag: 'admin-control', response: ok },
  { method: 'post', path: '/api/admin/push/send', summary: 'Push to a user, or to staff holding a permission', tag: 'admin-control', permission: 'ops.notifications.send', body: PushSendBody, idempotent: true },
  { method: 'get', path: '/api/config', summary: 'Unified remote config for web and mobile (public, ETag)', tag: 'config', query: ConfigQuery, response: RemoteConfigResponse, public: true },

  { method: 'get', path: '/api/operations/audit-events', summary: 'Audit events (list shape when list params are sent)', tag: 'operations', permission: 'ops.audit.view', query: AuditQuery, response: listOf(AuditEvent) },
  { method: 'get', path: '/api/operations/overview', summary: 'Operations overview (ETag / If-None-Match)', tag: 'operations', permission: 'ops.overview.view' },
  { method: 'post', path: '/api/operations/refund', summary: 'Refund a booking', tag: 'operations', permission: 'ops.commerce.refund', idempotent: true },
  { method: 'post', path: '/api/operations/sms-dispatch', summary: 'Send an SMS', tag: 'operations', permission: 'ops.sms.send', idempotent: true },
  { method: 'post', path: '/api/commerce/refund', summary: 'Refund a trip/booking', tag: 'operations', permission: 'ops.commerce.refund', idempotent: true },
  { method: 'get', path: '/api/search', summary: 'Permission-filtered global search', tag: 'operations', query: SearchQuery, response: SearchResponse },
  { method: 'get', path: '/api/stream', summary: 'Server-Sent Events (event: <topic>, data: StreamEventData)', tag: 'realtime', query: z.object({ topics: z.string().optional() }), responseContentType: 'text/event-stream' },
];

/** Parses a body with a contract schema; throws a 400-carrying error with the first issue. */
export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path?.length ? issue.path.join('.') : 'body';
    throw Object.assign(new Error(`${where}: ${issue?.message || 'invalid'}`), { status: 400 });
  }
  return result.data;
}

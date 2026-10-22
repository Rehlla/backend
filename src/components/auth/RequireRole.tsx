import React, { useEffect } from 'react';
import { ShieldAlert, LogIn } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth, type AuthRole } from '../../context/AuthContext';

interface RequireRoleProps {
  roles: AuthRole[];
  children: React.ReactNode;
}

/**
 * Client-side gate for privileged views.
 *
 * The Operations Console, Supplier Portal and Market Intelligence views had no
 * access control at all and were linked from the public navbar, so any visitor
 * could open them and read traveler PII and platform financials.
 *
 * This is a usability guard, not a security boundary. The real enforcement is
 * server-side in server/middleware/apiAccessPolicy.ts — anything reachable here
 * without the right role now returns 401/403 from the API regardless. Both
 * layers are needed: this one so people are not shown a broken screen, that one
 * so the data is actually protected.
 */
export const RequireRole: React.FC<RequireRoleProps> = ({ roles, children }) => {
  const { authRole, isSignedIn, navigateTo, setIntendedRoute, currentRoute } = useTrip();
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  // Was `Boolean(user)` — the Firebase user. Firebase Admin has no credentials
  // here, so federated sign-in always fails and that value is always null:
  // an Operations user signed in with email and password was shown the
  // "you do not have access" screen for a console they are entitled to.
  const isAllowed = isSignedIn && roles.includes(authRole);

  // Remember where they were headed so sign-in can return them there.
  useEffect(() => {
    if (!isAllowed) {
      setIntendedRoute(currentRoute);
    }
  }, [isAllowed, currentRoute, setIntendedRoute]);

  if (isAllowed) return <>{children}</>;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8">
        <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)]/15 flex items-center justify-center mx-auto mb-5">
          <ShieldAlert className="w-6 h-6 text-[var(--accent-primary)]" aria-hidden="true" />
        </div>

        <h1 className="text-lg font-extrabold text-[var(--text-primary)] mb-2">
          {isSignedIn
            ? isArabic ? 'ليس لديك صلاحية الوصول' : 'You do not have access'
            : isArabic ? 'تسجيل الدخول مطلوب' : 'Sign in required'}
        </h1>

        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
          {isSignedIn
            ? isArabic
              ? 'هذه الشاشة مخصصة لفريق التشغيل والموردين المعتمدين فقط.'
              : 'This screen is restricted to the operations team and approved suppliers.'
            : isArabic
              ? 'سجّل الدخول بحساب لديه الصلاحية المناسبة للمتابعة.'
              : 'Sign in with an account that has the required permissions to continue.'}
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          {!isSignedIn && (
            <button
              type="button"
              onClick={() => navigateTo('/auth/sign-in')}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer bg-[var(--btn-book-bg)] hover:bg-[var(--btn-book-hover)] text-[var(--btn-book-text)] transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              {isArabic ? 'تسجيل الدخول' : 'Sign in'}
            </button>
          )}
          <button
            type="button"
            onClick={() => navigateTo('/home')}
            className="px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--surface-container)] transition-colors"
          >
            {isArabic ? 'العودة للرئيسية' : 'Back to home'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface RequirePermissionProps {
  /** Every key here must be granted. */
  permission?: string | string[];
  /** At least one key here must be granted. */
  anyOf?: readonly string[];
  /** Rendered when access is missing. Defaults to a short notice; pass null to render nothing. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Permission-key sibling of RequireRole (docs/OPS_API_CONTRACT.md keys,
 * `*` and `area.*` honoured through useAuth().can). Like RequireRole it is a
 * usability guard only — the server checks the same key on every request.
 */
export const RequirePermission: React.FC<RequirePermissionProps> = ({ permission, anyOf, fallback, children }) => {
  const { can, canAny, isSignedIn } = useAuth();
  const { t } = useLanguage();
  const all = permission === undefined ? [] : Array.isArray(permission) ? permission : [permission];
  const allowed = isSignedIn && all.every(k => can(k)) && (!anyOf || anyOf.length === 0 || canAny(anyOf));

  if (allowed) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return (
    <div role="alert" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-6 text-center">
      <ShieldAlert className="w-6 h-6 mx-auto mb-2 text-[var(--accent-primary)]" aria-hidden="true" />
      <div className="text-sm font-bold text-[var(--text-primary)]">{t('ctl.access.deniedTitle')}</div>
      <div className="text-xs text-[var(--text-muted)] mt-1">{t('ctl.access.deniedBody')}</div>
    </div>
  );
};

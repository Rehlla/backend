import React, { useState, useEffect } from 'react';
import { Users, Vote, DollarSign, Check, X } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';
import { MobileSheet } from '../../common/MobileSheet';
import { api } from '../../../services/api';

/**
 * TripGroupSplitCard — group travel + split pay card (blueprint row #16 + #17).
 *
 * Mobile-first design: the card shows a compact summary with a thumb-friendly
 * "Invite" CTA. Tapping opens a MobileSheet with the full group management
 * UI (members list, voting, splits).
 */

interface TripGroupSplitCardProps {
  travelersCount: number;
  memberCount?: number;
  tripId?: string;
  onShare: () => void;
}

export const TripGroupSplitCard: React.FC<TripGroupSplitCardProps> = ({
  travelersCount,
  memberCount = 1,
  tripId,
  onShare,
}) => {
  const { language, t } = useLanguage();
  const { isDark } = useTheme();
  const [showSheet, setShowSheet] = useState(false);

  // Real group members + split state from the group planning backend.
  const [members, setMembers] = useState<Array<{ userId: string; role: string; status: string }>>([]);
  const [splits, setSplits] = useState<Array<{ userId: string; shareEGP: number; paidEGP: number }>>([]);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    api.getTripMembers(tripId).then(m => {
      if (!cancelled) setMembers(m as typeof members);
    }).catch(() => {});
    api.getTripSplits(tripId).then(s => {
      if (!cancelled) setSplits(s as typeof splits);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [tripId]);

  const totalOwed = splits.reduce((sum, s) => sum + (s.shareEGP || 0), 0);
  const totalPaid = splits.reduce((sum, s) => sum + (s.paidEGP || 0), 0);

  return (
    <>
      <div className={`p-6 sm:p-7 rounded-3xl border shadow-xl space-y-4 ${
        isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)]'
      }`}>
        <div className="flex items-center justify-between">
          <h3 className="text-base chart-heading font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>{t('myTrip.groupTravel')}</span>
          </h3>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
            {travelersCount} {t('myTrip.travelers')}
          </span>
        </div>

        <p className={`text-xs leading-relaxed ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]'}`}>
          {t('myTrip.shareAnInviteLink')}
        </p>

        {/* Member avatars + count — real members when a trip is shared */}
        {members.length > 0 ? (
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <div className="flex -space-x-2">
              {members.slice(0, 4).map((m, i) => (
                <div key={m.userId || i} className="w-6 h-6 rounded-full bg-[var(--accent-primary)]/20 border-2 border-[var(--surface-card)] flex items-center justify-center text-[8px] font-bold text-[var(--accent-primary)]">
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <span>{members.length} {t('group.memberCount', { count: members.length })}</span>
            {splits.length > 0 && totalOwed > 0 && (
              <span className="ms-auto font-mono font-bold text-[var(--accent-primary)]">
                {totalPaid}/{totalOwed.toLocaleString()} EGP
              </span>
            )}
          </div>
        ) : memberCount > 1 && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <div className="flex -space-x-2">
              {Array.from({ length: Math.min(memberCount, 4) }).map((_, i) => (
                <div key={i} className="w-6 h-6 rounded-full bg-[var(--accent-primary)]/20 border-2 border-[var(--surface-card)] flex items-center justify-center text-[8px] font-bold text-[var(--accent-primary)]">
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <span>{memberCount} {t('group.memberCount', { count: memberCount })}</span>
          </div>
        )}

        {/* Action buttons — thumb-friendly 44px min height */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onShare}
            className="flex-1 min-h-[44px] py-3 rounded-2xl bg-[var(--accent-secondary)] hover:brightness-110 text-[var(--accent-primary-ink)] text-xs font-extrabold flex items-center justify-center gap-2 shadow-md cursor-pointer transition-[background-color,border-color,color,box-shadow,transform,opacity] active:scale-95"
          >
            <Users className="w-3.5 h-3.5 text-[var(--surface-container)]" />
            <span>{t('myTrip.inviteFriend')}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSheet(true)}
            className="min-h-[44px] min-w-[44px] px-4 rounded-2xl bg-[var(--surface-hover)] text-[var(--text-primary)] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('group.splitExpenses')}</span>
          </button>
        </div>
      </div>

      {/* Mobile sheet for group management */}
      <MobileSheet open={showSheet} onClose={() => setShowSheet(false)} title={t('myTrip.groupTravel')}>
        <div className="space-y-6">
          {/* Members section */}
          <section>
            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--accent-primary)]" />
              {t('group.memberCount', { count: memberCount })}
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-hover)]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-xs font-bold text-white">
                    {language === 'ar' ? 'م' : 'Y'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{language === 'ar' ? 'أنت' : 'You'}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">{t('group.paid')}</p>
                  </div>
                </div>
                <Check className="w-4 h-4 text-green-500" />
              </div>
              {members.filter(m => m.status !== 'accepted').map((m, i) => (
                <div key={m.userId || i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-hover)]/60">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--surface-container)] flex items-center justify-center text-xs font-bold text-[var(--text-secondary)]">
                      {String.fromCharCode(66 + (i % 25))}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-secondary)]">
                        {m.status === 'invited' ? (language === 'ar' ? 'بانتظار القبول' : 'Invite pending') : (language === 'ar' ? 'عضو' : 'Member')}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-amber-400">{m.status}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { setShowSheet(false); onShare(); }}
              className="w-full mt-3 min-h-[44px] py-3 rounded-2xl border border-dashed border-[var(--accent-primary)]/40 text-[var(--accent-primary)] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform"
            >
              <Users className="w-3.5 h-3.5" />
              {t('group.inviteSent')}
            </button>
          </section>

          {/* Split section — real split state when it exists */}
          <section>
            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[var(--accent-primary)]" />
              {t('group.splitExpenses')}
            </h4>
            {splits.length > 0 ? (
              <div className="space-y-2">
                {splits.map((s, i) => {
                  const settled = (s.paidEGP || 0) >= (s.shareEGP || 0);
                  return (
                    <div key={s.userId || i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-hover)]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-xs font-bold text-white">
                          {String.fromCharCode(65 + (i % 26))}
                        </div>
                        <span className="text-sm text-[var(--text-primary)]">{(s.shareEGP || 0).toLocaleString()} EGP</span>
                      </div>
                      {settled
                        ? <Check className="w-4 h-4 text-green-500" />
                        : <span className="text-[10px] font-bold text-amber-400">{(s.paidEGP || 0).toLocaleString()} / {(s.shareEGP || 0).toLocaleString()}</span>
                      }
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[var(--surface-hover)] text-center">
                <p className="text-xs text-[var(--text-secondary)]">
                  {t('group.pending')}
                </p>
              </div>
            )}
          </section>

          {/* Vote section */}
          <section>
            <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Vote className="w-4 h-4 text-[var(--accent-primary)]" />
              {language === 'ar' ? 'التصويت على الأنشطة' : 'Vote on Activities'}
            </h4>
            <div className="p-4 rounded-xl bg-[var(--surface-hover)] text-center">
              <p className="text-xs text-[var(--text-secondary)]">
                {language === 'ar' ? 'لا توجد أنشطة للتصويت عليها بعد' : 'No activities to vote on yet'}
              </p>
            </div>
          </section>
        </div>
      </MobileSheet>
    </>
  );
};

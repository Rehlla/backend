import React from 'react';
import { Waves } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * ConditionsBadge — live water-activity suitability on a discovery card.
 *
 * The verdict is the server's, never the client's: the marine endpoint judges
 * measured wind against written thresholds (activity maxWindKnots first, then
 * the research bands in docs/research/DAHAB_WATER_WIND_ENVIRONMENT.md), and
 * this badge only renders what that payload says. No payload — no badge; a
 * card with no signal must not imply a calm sea.
 */
export type ConditionsVerdict = 'go' | 'caution' | 'avoid';

interface ConditionsBadgeProps {
  verdict: ConditionsVerdict;
  /** First reason from the server payload; shown in a title tooltip + sr-only. */
  reason?: string;
}

const VERDICT_STYLE: Record<ConditionsVerdict, string> = {
  go: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  caution: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
  avoid: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25',
};

const VERDICT_LABEL: Record<ConditionsVerdict, { en: string; ar: string }> = {
  go: { en: 'Good to go', ar: 'مناسب' },
  caution: { en: 'Caution', ar: 'بحذر' },
  avoid: { en: 'Stand down', ar: 'أجّلها' },
};

export const ConditionsBadge: React.FC<ConditionsBadgeProps> = ({ verdict, reason }) => {
  const { language } = useLanguage();
  const label = language === 'ar' ? VERDICT_LABEL[verdict].ar : VERDICT_LABEL[verdict].en;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${VERDICT_STYLE[verdict]}`}
      title={reason}
    >
      <Waves className="w-3 h-3" aria-hidden="true" />
      <span aria-label={reason ? `${label} — ${reason}` : label}>{label}</span>
    </span>
  );
};

export default ConditionsBadge;
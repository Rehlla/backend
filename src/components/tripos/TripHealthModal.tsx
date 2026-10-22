import React from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Wrench
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTrip } from '../../context/TripContext';

interface TripHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TripHealthModal: React.FC<TripHealthModalProps> = ({ isOpen, onClose }) => {
  const { language, isRTL , t} = useLanguage();
  const { tripHealth, resolveTripConflict } = useTrip();

  if (!isOpen) return null;

  return (
    <div
      id="modal-trip-health-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      dir={isRTL ? 'rtl' : 'ltr'}
    
      role="dialog"
      aria-modal="true"
      aria-labelledby="trip-health-modal-dialog-1-title"
    >
      <div
        id="modal-trip-health-container"
        className="bg-[var(--surface-card)] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 my-8 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 bg-[var(--surface-card)] text-white flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-[12px] font-black text-emerald-300">
                {t('tripos.tRIPOSHEALTHCONFLICT')}
              </span>
            </div>
            <h2 id="trip-health-modal-dialog-1-title" className="text-xl sm:text-2xl font-extrabold">
              {t('tripos.tripHealthSafetyVerifier')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              {t('tripos.automatedVerificationOfDive')}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-2xl bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Summary Banner */}
        <div className="p-6 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs ${
                tripHealth.criticalCount === 0 && tripHealth.warningCount === 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {tripHealth.criticalCount === 0 && tripHealth.warningCount === 0 ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="text-sm font-extrabold text-slate-950">
                {language === 'ar' ? tripHealth.statusLabelAr : tripHealth.statusLabel}
              </div>
              <div className="text-xs text-slate-500">
                {tripHealth.criticalCount === 0 && tripHealth.warningCount === 0
                  ? t('tripos.zeroTimingCollisionsOr')
                  : t('tripos.criticalWarnings', { criticalCount: tripHealth.criticalCount, warningCount: tripHealth.warningCount })}
              </div>
            </div>
          </div>
        </div>

        {/* Conflicts List */}
        <div className="p-6 sm:p-8 space-y-4 overflow-y-auto flex-1">
          {tripHealth.conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className={`p-5 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] space-y-3 ${
                conflict.resolved
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : conflict.severity === 'critical'
                  ? 'bg-rose-50/70 border-rose-200'
                  : conflict.severity === 'warning'
                  ? 'bg-amber-50/70 border-amber-200'
                  : 'bg-sky-50/70 border-sky-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                        conflict.resolved
                          ? 'bg-emerald-200 text-emerald-900'
                          : conflict.severity === 'critical'
                          ? 'bg-rose-200 text-rose-900'
                          : conflict.severity === 'warning'
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-sky-200 text-sky-900'
                      }`}
                    >
                      {conflict.resolved
                        ? t('tripos.resolved')
                        : conflict.severity.toUpperCase()}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {t('tripos.day', { affectedDayNumber: conflict.affectedDayNumber })}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-950">
                    {language === 'ar' ? conflict.titleAr : conflict.title}
                  </h4>
                </div>

                {!conflict.resolved && (
                  <button
                    type="button"
                    onClick={() => resolveTripConflict(conflict.id)}
                    className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-black text-amber-300 font-bold text-xs shadow-xs cursor-pointer transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>{t('tripos.autoFix')}</span>
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {language === 'ar' ? conflict.descriptionAr : conflict.description}
              </p>

              <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2 text-xs text-slate-700 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-[var(--brand-sand)] shrink-0" />
                <span>
                  <strong>{t('tripos.guidance')}</strong>{' '}
                  {language === 'ar' ? conflict.suggestedFixAr : conflict.suggestedFix}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl bg-slate-950 hover:bg-black text-white font-bold text-xs cursor-pointer transition-colors"
          >
            {t('common.close-2')}
          </button>
        </div>
      </div>
    </div>
  );
};

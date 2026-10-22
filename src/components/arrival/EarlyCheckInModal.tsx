import React, { useState, useEffect } from 'react';
import { 
  Building, 
  Clock, 
  X, 
  Check, 
  ArrowRight, 
  ArrowLeft,
  Sparkles, 
  Luggage, 
  Coffee, 
  Waves, 
  RefreshCw, 
  AlertCircle 
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface EarlyCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (option: 'luggage' | 'breakfast' | 'beach') => void;
}

export const EarlyCheckInModal: React.FC<EarlyCheckInModalProps> = ({
  isOpen,
  onClose,
  onSelectOption,
}) => {
  const { language, isRTL, t } = useLanguage();
  const [isChecking, setIsChecking] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setIsChecking(true);
      const timer = setTimeout(() => {
        setIsChecking(false);
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div 
        className="bg-[var(--surface-card)] rounded-3xl max-w-md w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-primary)]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] text-[var(--accent-primary)] flex items-center justify-center font-bold border border-[var(--border-subtle)]">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                {t('arrival.dahabBayHotel')}
              </span>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {t('arrival.earlyCheckinStatus')}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Checking vs Result State */}
        {isChecking ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[var(--surface-container)] text-[var(--accent-primary)] flex items-center justify-center mx-auto animate-spin border border-[var(--border-subtle)]">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-sm text-[var(--text-primary)]">
                {t('arrival.checkingWithYourHotel')}
              </p>
              <p className="text-xs text-[var(--text-secondary)]/70">
                {t('arrival.contactingDahabBayHotel')}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Reassuring Notification */}
            <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-amber-500/30 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>{t('arrival.earlyCheckinIsntAvailable')}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed">
                {t('arrival.yourSeaViewDeluxe')}{' '}
                <strong className="text-[var(--text-primary)]">{t('arrival.seaViewCheckinTime')}</strong>.
              </p>
            </div>

            {/* Alternatives - Do not leave user at a dead end */}
            <div className="space-y-2 pt-1">
              <span className="text-[12px] font-bold text-[var(--text-secondary)]/70 block">
                {t('arrival.greatWaysToSpend')}
              </span>

              <button
                type="button"
                id="early-checkin-alt-luggage"
                onClick={() => {
                  onClose();
                  onSelectOption('luggage');
                }}
                className="w-full p-3 rounded-2xl bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-start flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[var(--surface-card)] text-[var(--accent-primary)] flex items-center justify-center border border-[var(--border-subtle)]">
                    <Luggage className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[var(--text-primary)] block">
                      {t('arrival.leaveYourBagsAt')}
                    </span>
                    <span className="text-[12px] text-[var(--text-secondary)]/70">
                      {t('arrival.complimentarySafeLuggageDrop')}
                    </span>
                  </div>
                </div>
                {isRTL ? <ArrowLeft className="w-4 h-4 text-[var(--text-secondary)]/40 group-hover:text-[var(--accent-secondary)] transition-colors" /> : <ArrowRight className="w-4 h-4 text-[var(--text-secondary)]/40 group-hover:text-[var(--accent-secondary)] transition-colors" />}
              </button>

              <button
                type="button"
                id="early-checkin-alt-breakfast"
                onClick={() => {
                  onClose();
                  onSelectOption('breakfast');
                }}
                className="w-full p-3 rounded-2xl bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-start flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[var(--surface-card)] text-[var(--accent-secondary)] flex items-center justify-center border border-[var(--border-subtle)]">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[var(--text-primary)] block">
                      {t('arrival.grabSeasideBreakfast')}
                    </span>
                    <span className="text-[12px] text-[var(--text-secondary)]/70">
                      {t('arrival.freshJuiceShakshukaAlong')}
                    </span>
                  </div>
                </div>
                {isRTL ? <ArrowLeft className="w-4 h-4 text-[var(--text-secondary)]/40 group-hover:text-[var(--accent-secondary)] transition-colors" /> : <ArrowRight className="w-4 h-4 text-[var(--text-secondary)]/40 group-hover:text-[var(--accent-secondary)] transition-colors" />}
              </button>

              <button
                type="button"
                id="early-checkin-alt-beach"
                onClick={() => {
                  onClose();
                  onSelectOption('beach');
                }}
                className="w-full p-3 rounded-2xl bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-start flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[var(--surface-card)] text-[var(--accent-primary)] flex items-center justify-center border border-[var(--border-subtle)]">
                    <Waves className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[var(--text-primary)] block">
                      {t('arrival.relaxByTheLighthouse')}
                    </span>
                    <span className="text-[12px] text-[var(--text-secondary)]/70">
                      {t('arrival.shadedCushionsCalmSea')}
                    </span>
                  </div>
                </div>
                {isRTL ? <ArrowLeft className="w-4 h-4 text-[var(--text-secondary)]/40 group-hover:text-[var(--accent-secondary)] transition-colors" /> : <ArrowRight className="w-4 h-4 text-[var(--text-secondary)]/40 group-hover:text-[var(--accent-secondary)] transition-colors" />}
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-full bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] text-xs font-bold text-[var(--text-secondary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
              >
                {t('arrival.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


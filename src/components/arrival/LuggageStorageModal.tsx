import React, { useState } from 'react';
import { 
  Luggage, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  DollarSign, 
  Navigation, 
  X, 
  Check, 
  Building,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface LuggageStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmStorage: (storageName: string) => void;
}

export const LuggageStorageModal: React.FC<LuggageStorageModalProps> = ({
  isOpen,
  onClose,
  onConfirmStorage,
}) => {
  const { language, isRTL, t } = useLanguage();
  const [selectedStorage, setSelectedStorage] = useState<'hotel' | 'locker'>('hotel');

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div 
        className="bg-[var(--surface-card)] rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-primary)]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] text-[var(--accent-secondary)] flex items-center justify-center font-bold border border-[var(--border-subtle)]">
              <Luggage className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                {t('arrival.luggageStorage')}
              </span>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {t('arrival.whereWouldYouLike')}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="w-8 h-8 rounded-full bg-[var(--surface-card)]/5 hover:bg-[var(--surface-card)]/10 flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Recommended Option Card */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              <span>{t('arrival.recommendedForYou')}</span>
            </span>
            <span className="text-[12px] font-bold text-[var(--accent-primary)] bg-[var(--surface-container)] px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">
              {t('arrival.freeWithYourBooking')}
            </span>
          </div>

          {/* Primary Recommended Option: Dahab Bay Hotel Concierge */}
          <div 
            onClick={() => setSelectedStorage('hotel')}
            className={`p-5 rounded-2xl border-2 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer space-y-3 ${
              selectedStorage === 'hotel'
                ? 'border-[var(--accent-secondary)] bg-[var(--surface-container)] shadow-md'
                : 'border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-white/20'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--surface-card)] text-[var(--accent-primary)] flex items-center justify-center flex-shrink-0 border border-[var(--border-subtle)]">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h4 className=" font-bold text-base text-[var(--text-primary)]">
                    {t('arrival.dahabBayHotelConcierge')}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]/70 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>{t('arrival.lighthousePromenade120mAway')}</span>
                  </p>
                </div>
              </div>

              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 ${
                selectedStorage === 'hotel'
                  ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)] text-[var(--surface-container)]'
                  : 'border-white/30'
              }`}>
                {selectedStorage === 'hotel' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>

            {/* Key Storage Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
              <div className="p-2.5 rounded-xl bg-[var(--surface-card)] border border-white/5 space-y-0.5">
                <span className="text-[11px] font-bold text-[var(--text-secondary)]/40 block">{t('arrival.opening')}</span>
                <span className="font-bold text-[var(--accent-primary)] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]"></span>
                  <span>{t('arrival.openNow247')}</span>
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-[var(--surface-card)] border border-white/5 space-y-0.5">
                <span className="text-[11px] font-bold text-[var(--text-secondary)]/40 block">{t('arrival.cost')}</span>
                <span className="font-bold text-[var(--text-primary)]">{t('arrival.freeIncluded')}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-[var(--surface-card)] border border-white/5 space-y-0.5 col-span-2 sm:col-span-1">
                <span className="text-[11px] font-bold text-[var(--text-secondary)]/40 block">{t('arrival.duration')}</span>
                <span className="font-bold text-[var(--text-primary)]">{t('arrival.until300PMOr')}</span>
              </div>
            </div>

            {/* Directions & Security note */}
            <div className="p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]/80 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[var(--accent-primary)]">
                <Navigation className="w-3.5 h-3.5" />
                <span>{t('arrival.directionsFromYourDropoff')}</span>
              </div>
              <p className="text-[12px] leading-relaxed">
                {t('arrival.head100mStraightDown')}
              </p>
            </div>
          </div>

          {/* Secondary Nearby Option */}
          <div 
            onClick={() => setSelectedStorage('locker')}
            className={`p-4 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center justify-between ${
              selectedStorage === 'locker'
                ? 'border-[var(--accent-secondary)] bg-[var(--surface-container)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] text-[var(--text-secondary)] flex items-center justify-center flex-shrink-0 border border-[var(--border-subtle)]">
                <Luggage className="w-4 h-4" />
              </div>
              <div>
                <h5 className="font-bold text-xs text-[var(--text-primary)]">
                  {t('arrival.lighthouseBeachLockerHub')}
                </h5>
                <p className="text-[12px] text-[var(--text-secondary)]/70">
                  {t('arrival.directlyOnTheBeach')}
                </p>
              </div>
            </div>

            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
              selectedStorage === 'locker'
                ? 'border-[var(--accent-secondary)] bg-[var(--accent-secondary)] text-[var(--surface-container)]'
                : 'border-white/30'
            }`}>
              {selectedStorage === 'locker' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="pt-2">
          <button
            type="button"
            id="confirm-luggage-choice-btn"
            onClick={() => {
              const name = selectedStorage === 'hotel' 
                ? (t('arrival.dahabBayHotelConcierge-2'))
                : (t('arrival.lighthouseBeachLockerHub'));
              onConfirmStorage(name);
              onClose();
            }}
            className="w-full py-3.5 px-5 rounded-full bg-[var(--accent-secondary)] hover:brightness-110 text-[var(--accent-primary-ink)] font-bold text-sm shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Check className="w-4 h-4 text-[var(--surface-container)] stroke-[2.5]" />
            <span>{t('arrival.chooseThisPlace')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};


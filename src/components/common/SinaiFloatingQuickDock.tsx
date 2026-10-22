import React, { useState, useEffect } from 'react';
import { 
  LifeBuoy, 
  ShieldCheck, 
  MapPin, 
  Sparkles, 
  Compass, 
  MessageSquare,
  Waves,
  X,
  PhoneCall,
  Bot
} from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { EmergencyModal } from './EmergencyModal';
import { SinaiPassbookModal } from './SinaiPassbookModal';

export const SinaiFloatingQuickDock: React.FC = () => {
  // isAiAssistantOpen was read from the context but never existed there, and no
  // such state exists anywhere: AiTravelAssistant is an always-rendered inline
  // panel with no open/close concept. The reference was permanently undefined,
  // so it contributed nothing to isModalActive. Removed rather than invented.
  const { navigateTo, currentRoute } = useTrip();
  const { language, isRTL , t} = useLanguage();

  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [isPassbookOpen, setIsPassbookOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isModalActive = isEmergencyOpen || isPassbookOpen || currentRoute === '/daygi';

  // Dismiss the expanded toolkit with Escape.
  useEffect(() => {
    if (!isExpanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isExpanded]);

  return (
    <>
      {/* Floating Quick Action Pill - auto-hidden on mobile viewports when modals or DayGI are active */}
      <div 
        id="sinai-quick-dock"
        dir={isRTL ? 'rtl' : 'ltr'}
        className={`fixed bottom-[76px] md:bottom-6 end-4 sm:end-6 z-40 flex flex-col items-end gap-2 pointer-events-auto transition-opacity duration-300 ${
          isModalActive ? 'hidden sm:flex' : 'flex'
        }`}
      >
        {/* Expanded Quick Drawer */}
        {isExpanded && (
          <div className="backdrop-blur-xl border p-3 rounded-2xl shadow-2xl space-y-2 mb-1 w-64 animate-in slide-in-from-bottom-3 duration-200 bg-[var(--surface-card)]/95 border-[var(--border-subtle)] text-[var(--text-primary)]">
            <div className="flex items-center justify-between border-b pb-2 px-1 border-[var(--border-subtle)]">
              <span className="text-xs font-bold text-[var(--accent-secondary)]">
                {t('common.dahabTravelToolkit')}
              </span>
              <button 
                type="button"
                onClick={() => setIsExpanded(false)}
                aria-label={t('common.close')}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tool 1: Emergency Dial & Decompression */}
            <button
              type="button"
              onClick={() => {
                setIsEmergencyOpen(true);
                setIsExpanded(false);
              }}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl border text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] text-start cursor-pointer bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-300"
            >
              <LifeBuoy className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <div>
                <div className="text-[12px] font-bold text-rose-200">
                  {t('common.sinai247RapidEmergency')}
                </div>
                <div className="text-xs font-normal text-rose-300/80">
                  {t('common.ambulanceHyperbaricMed')}
                </div>
              </div>
            </button>

            {/* Tool 2: Verified Digital Sinai Pass */}
            <button
              type="button"
              onClick={() => {
                setIsPassbookOpen(true);
                setIsExpanded(false);
              }}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl border text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] text-start cursor-pointer bg-[var(--accent-primary)]/15 hover:bg-[var(--accent-primary)]/25 border-[var(--accent-primary)]/30 text-[var(--accent-primary)]"
            >
              <ShieldCheck className="w-4 h-4 flex-shrink-0 text-[var(--accent-primary)]" />
              <div>
                <div className="text-[12px] font-bold text-[var(--text-primary)]">
                  {t('common.sinaiDigitalPassbook')}
                </div>
                <div className="text-xs font-normal text-[var(--text-secondary)]">
                  {t('common.checkpointClearanceQR')}
                </div>
              </div>
            </button>

            {/* Tool 3: DayGI Concierge */}
            <button
              type="button"
              onClick={() => {
                navigateTo('/daygi');
                setIsExpanded(false);
              }}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl border text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] text-start cursor-pointer bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300"
            >
              <Bot className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <div>
                <div className="text-[12px] font-bold text-emerald-200">
                  {t('daygi.askDayGI')}
                </div>
                <div className="text-xs font-normal text-emerald-300/80">
                  {t('common.aiConciergeHelp')}
                </div>
              </div>
            </button>

            {/* Tool 4: Food & Spontaneous Discovery */}
            <button
              type="button"
              onClick={() => {
                navigateTo('/food');
                setIsExpanded(false);
              }}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl border text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] text-start cursor-pointer bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 text-amber-300"
            >
              <Compass className="w-4 h-4 flex-shrink-0 text-[var(--accent-secondary)]" />
              <div>
                <div className="text-[12px] font-bold text-amber-200">
                  {t('common.foodChillNow')}
                </div>
                <div className="text-xs font-normal text-amber-300/80">
                  {t('common.liveCuratedSpotsNearby')}
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Floating Trigger Button */}
        <div className="flex items-center gap-2">
          {/* 1-Tap Emergency Trigger */}
          <button
            type="button"
            onClick={() => setIsEmergencyOpen(true)}
            aria-label={t('common.sinai247RapidEmergency')}
            title={t('common.sinai247RapidEmergency')}
            className="w-11 h-11 rounded-full border-2 shadow-lg flex items-center justify-center transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md bg-rose-950/90 text-rose-300 border-rose-500/60 hover:bg-rose-900"
          >
            <LifeBuoy className="w-5 h-5 animate-pulse text-rose-500" />
          </button>

          {/* Master Sinai Quick Toolkit Button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-label={t('common.dahabTools')}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-full border-2 shadow-xl transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:scale-102 active:scale-98 cursor-pointer backdrop-blur-md text-xs font-bold bg-[var(--surface-card)] text-[var(--text-primary)] border-[var(--accent-primary)]/50 hover:bg-[var(--surface-container)]"
          >
            <Sparkles className="w-4 h-4 text-[var(--accent-secondary)]" />
            <span className="hidden sm:inline">
              {t('common.dahabTools')}
            </span>
          </button>
        </div>
      </div>

      {/* Emergency Modal Instance */}
      <EmergencyModal 
        isOpen={isEmergencyOpen} 
        onClose={() => setIsEmergencyOpen(false)} 
      />

      {/* Sinai Passbook Modal Instance */}
      <SinaiPassbookModal
        isOpen={isPassbookOpen}
        onClose={() => setIsPassbookOpen(false)}
      />
    </>
  );
};

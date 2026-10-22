import React, { useState } from 'react';
import { 
  Clock, 
  Sparkles, 
  MapPin, 
  Luggage, 
  Coffee, 
  Waves, 
  Footprints, 
  Building, 
  Check, 
  X, 
  RotateCcw,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface FirstTwoHoursPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAcceptPlan: () => void;
  onChangePlan?: () => void;
}

export const FirstTwoHoursPlanModal: React.FC<FirstTwoHoursPlanModalProps> = ({
  isOpen,
  onClose,
  onAcceptPlan,
  onChangePlan,
}) => {
  const { language, isRTL, t } = useLanguage();
  const [activeSegment, setActiveSegment] = useState<number | null>(null);

  if (!isOpen) return null;

  const planSteps = [
    {
      time: '10:00',
      title: t('arrival.arriveInDahab'),
      desc: t('arrival.privateTransferDropoffAt'),
      icon: MapPin,
      iconBg: 'bg-[var(--surface-container)] text-[var(--accent-primary)]',
    },
    {
      time: '10:15',
      title: t('arrival.leaveBags'),
      desc: t('arrival.dropLuggageSecurelyAt'),
      icon: Luggage,
      iconBg: 'bg-[var(--surface-container)] text-[var(--accent-primary)]',
    },
    {
      time: '10:30',
      title: t('arrival.breakfast'),
      desc: t('arrival.freshMangoJuiceWarm'),
      icon: Coffee,
      iconBg: 'bg-[var(--surface-container)] text-[var(--accent-secondary)]',
    },
    {
      time: '11:15',
      title: t('arrival.coffeeWalk'),
      desc: t('arrival.bedouinSpicedCoffeeAnd'),
      icon: Footprints,
      iconBg: 'bg-[var(--surface-container)] text-[var(--accent-primary)]',
    },
    {
      time: '12:00',
      title: t('arrival.beach'),
      desc: t('arrival.relaxOnShadedShore'),
      icon: Waves,
      iconBg: 'bg-[var(--surface-container)] text-[var(--accent-primary)]',
    },
    {
      time: '12:30',
      title: t('arrival.headTowardHotel'),
      desc: t('arrival.slowWalkBackTo'),
      icon: Building,
      iconBg: 'bg-[var(--surface-container)] text-[var(--accent-primary)]',
    },
    {
      time: t('arrival.300PM'),
      title: t('arrival.checkin'),
      desc: t('arrival.roomReadyCheckInto'),
      icon: Check,
      iconBg: 'bg-[var(--accent-primary)] text-[var(--surface-card)]',
      isHighlight: true,
    },
  ];

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div 
        className="bg-[var(--surface-card)] rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto text-[var(--text-primary)]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] text-[var(--accent-secondary)] flex items-center justify-center font-bold border border-[var(--border-subtle)]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                {t('arrival.suggestedMiniPlan')}
              </span>
              <h3 className="text-xl font-bold text-[var(--text-primary)]">
                {t('arrival.yourFirst2Hours')}
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

        {/* Dynamic Context Banner */}
        <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--accent-secondary)]" />
            <span className="text-[var(--text-secondary)]/70">{t('arrival.timeAvailable')}</span>
            <span className="font-bold text-[var(--text-primary)]">{t('arrival.2h20mBeforeCheckin')}</span>
          </div>
          <span className="text-[12px] font-bold text-[var(--accent-primary)] bg-[var(--surface-card)] px-2.5 py-0.5 rounded-full border border-[var(--border-subtle)]">
            {t('arrival.zeroRush')}
          </span>
        </div>

        {/* Timeline Steps */}
        <div className={`space-y-3 relative ${isRTL ? 'pr-2 before:absolute before:right-6 before:top-3 before:bottom-3 before:w-0.5 before:bg-[var(--btn-util-bg)]' : 'pl-2 before:absolute before:left-6 before:top-3 before:bottom-3 before:w-0.5 before:bg-[var(--btn-util-bg)]'}`}>
          {planSteps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div 
                key={idx}
                className={`relative flex items-start gap-3.5 p-2.5 rounded-2xl transition-colors ${
                  step.isHighlight ? 'bg-[var(--surface-container)] border border-[var(--accent-primary)]/30' : 'hover:bg-[var(--surface-container)]/50'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 font-bold text-xs shadow-xs border border-[var(--border-subtle)] ${step.iconBg}`}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[var(--accent-secondary)]">
                      {step.time}
                    </span>
                    <h4 className="text-sm font-bold text-[var(--text-primary)]">
                      {step.title}
                    </h4>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Disclaimer Note */}
        <p className="text-[12px] text-[var(--text-secondary)]/50 italic text-center">
          {t('arrival.thisIsAnAdaptive')}
        </p>

        {/* Actions */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            id="change-plan-btn"
            onClick={() => {
              if (onChangePlan) onChangePlan();
              else onClose();
            }}
            className="py-3 px-4 rounded-full bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] text-xs font-bold text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('arrival.changePlan')}</span>
          </button>

          <button
            type="button"
            id="accept-plan-btn"
            onClick={() => {
              onAcceptPlan();
              onClose();
            }}
            className="py-3 px-4 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-xs font-bold text-[var(--surface-card)] shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 text-[var(--surface-card)] stroke-[2.5]" />
            <span>{t('arrival.startMyFirst2')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};


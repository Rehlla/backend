import React, { useEffect, useState } from 'react';
import { 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  Calendar, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  HelpCircle, 
  RefreshCw, 
  Sparkles, 
  ChevronRight, 
  CheckCircle2, 
  Waves, 
  Compass, 
  MapPin, 
  Coffee, 
  Sun, 
  Info,
  X,
  MessageSquare,
  Sailboat
} from 'lucide-react';
import { TravelerNav } from '../mytrip/TravelerNav';
import { useTrip } from '../../context/TripContext';
import { CategoryIcon } from '../common/CategoryIcon';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';

interface ChangeAndRecoveryViewProps {
  onBackToMyTrip: () => void;
  onBackToCompanion?: () => void;
  onExploreClick?: () => void;
  onOpenHelp?: (topic?: string) => void;
  onTripUpdated?: (updatedDetails: {
    activity: string;
    newTime: string;
    day: string;
  }) => void;
}

export type AlternativeOptionId = 'option-a' | 'option-b' | 'option-c';

export interface AlternativeOption {
  id: AlternativeOptionId;
  label: string;
  labelAr: string;
  title: string;
  titleAr: string;
  timeSlot: string;
  timeSlotAr: string;
  dayLabel: string;
  dayLabelAr: string;
  badge: 'Recommended' | 'More flexible' | 'Alternative';
  badgeAr: 'الأفضل لجدولك' | 'أكثر مرونة' | 'بديل مميز';
  badgeStyle: 'emerald' | 'amber' | 'blue';
  description: string;
  descriptionAr: string;
  keyPoints: string[];
  keyPointsAr: string[];
  warning?: string;
  warningAr?: string;
  hasConflict?: boolean;
  conflictDetails?: {
    conflictingActivity: string;
    conflictingActivityAr: string;
    conflictingTime: string;
    conflictingTimeAr: string;
    explanation: string;
    explanationAr: string;
  };
}

export const ChangeAndRecoveryView: React.FC<ChangeAndRecoveryViewProps> = ({
  onBackToMyTrip,
  onBackToCompanion,
  onExploreClick,
  onOpenHelp,
  onTripUpdated,
}) => {
  const { language, isRTL , t} = useLanguage();
  const { recordLedgerEntry, shiftActivityBetweenDays, updateActivityInDay, activeTrip, profile } = useTrip();

  /**
   * The real marine reading, and whether it is actually a problem.
   *
   * This page opened with "Today's boat trip won't be as pleasant due to wind",
   * a "Marine Weather Update · 11:30 AM" badge and "Sea Condition: 24 knots ·
   * 1.4m chop" — for every traveler, on every day, whether or not they had a
   * boat trip and whether or not there was any wind. It is the screen a
   * traveler lands on when something has gone wrong, so opening it by
   * inventing what went wrong is the worst place to do it.
   *
   * 20 knots is where Dahab's boat operators start calling a day uncomfortable;
   * below that the page is a plan-change tool, which is what it always was.
   */
  const [wind, setWind] = useState<{ knots: number; direction: string; observedAt: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getWeatherTelemetry().then((w) => {
      if (cancelled || !w?.available) return;
      setWind({ knots: w.wind.speedKnots, direction: w.wind.direction, observedAt: w.observedAt });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const CHOPPY_THRESHOLD_KNOTS = 20;
  const isChoppy = wind !== null && wind.knots >= CHOPPY_THRESHOLD_KNOTS;
  const travelerFirstName = (profile.name || '').trim().split(/\s+/)[0];
  const observedLabel = wind
    ? new Date(wind.observedAt).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
    : null;
  // Was the literal 'DHB-TRIP-894' on all three recovery ledger entries.
  const recoveryTripId = activeTrip?.id || '';
  const [activeNavTab, setActiveNavTab] = useState<'home' | 'mytrip' | 'explore' | 'bookings' | 'profile'>('mytrip');

  // Currently selected alternative for comparison & rebooking
  const [selectedOptionId, setSelectedOptionId] = useState<AlternativeOptionId>('option-a');

  // Interactive rebooking workflow state: 'viewing' | 'confirming' | 'processing' | 'success'
  const [rebookingStep, setRebookingStep] = useState<'viewing' | 'confirming' | 'processing' | 'success'>('viewing');

  // Conflict modal state for Option B
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [conflictResolutionChoice, setConflictResolutionChoice] = useState<'unresolved' | 'move_safari'>('unresolved');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // The 3 Curated Alternatives
  const alternatives: AlternativeOption[] = [
    {
      id: 'option-a',
      label: 'Option A — Reschedule',
      labelAr: 'الخيار أ — تأجيل الرحلة لغدٍ',
      title: 'Boat Trip Tomorrow',
      titleAr: 'رحلة اليخت غداً صباحاً',
      timeSlot: '10:00 AM',
      timeSlotAr: '١٠:٠٠ صباحاً',
      dayLabel: 'Tomorrow · 10:00 AM',
      dayLabelAr: 'غداً (اليوم ٣) · ١٠:٠٠ ص',
      badge: 'Recommended',
      badgeAr: 'الأفضل لجدولك',
      badgeStyle: 'emerald',
      description: 'Keep the same experience and move it to a better weather window tomorrow morning.',
      descriptionAr: 'الاحتفاظ بنفس رحلة اليخت المميزة ونقلها لموعد طقس مثالي وهادئ تماماً صباح الغد.',
      keyPoints: [
        'Fits your itinerary seamlessly ✓',
        'Sea conditions are calm and sunny tomorrow',
        'All transport and boat bookings automatically adjusted',
      ],
      keyPointsAr: [
        'يتطابق مع جدول رحلتك بدون أي تعارض ✓',
        'حالة البحر والرياح هادئة ومشمسة جداً غداً',
        'تعديل حجز المركب والسائق تلقائياً وبدون أي جهد منك',
      ],
    },
    {
      id: 'option-b',
      label: 'Option B — Replace Today',
      labelAr: 'الخيار ب — بديل بري ممتع اليوم',
      title: 'Desert Canyon & Mountain Trek',
      titleAr: 'سفاري وادي الوشواشي وجبال دهب',
      timeSlot: '11:30 AM',
      timeSlotAr: '١١:٣٠ صباحاً',
      dayLabel: 'Today · 11:30 AM',
      dayLabelAr: 'اليوم (اليوم ٢) · ١١:٣٠ ص',
      badge: 'Alternative',
      badgeAr: 'بديل مميز',
      badgeStyle: 'blue',
      description: 'Replace the boat trip with an inland canyon safari protected from coastal winds.',
      descriptionAr: 'استبدال رحلة البحر بجولة جبلية ووديان ساحرة محمية تماماً من الرياح الساحلية.',
      keyPoints: [
        'Takes place today as planned',
        'Wind-safe desert canyon adventure',
        'Minor schedule adjustment required for afternoon activity',
      ],
      keyPointsAr: [
        'يقام اليوم في نفس توقيتك بدون فراغ',
        'مغامرة وديان جبلية ساحرة لا تتأثر بالبحر',
        'يتطلب تعديل بسيط لنشاط العصر (سفاري البيتش باجي)',
      ],
      hasConflict: true,
      conflictDetails: {
        conflictingActivity: 'Desert Quad Tour',
        conflictingActivityAr: 'سفاري البيتش باجي الصحراوي',
        conflictingTime: '03:00 PM',
        conflictingTimeAr: '٠٣:٠٠ عصراً',
        explanation: 'Option B ends at 02:45 PM, leaving only 15 min buffer before Quad tour.',
        explanationAr: 'جولة الوديان تنتهي الساعة ٢:٤٥ م، تاركة ١٥ دقيقة فقط قبل نشاط العصر.',
      },
    },
    {
      id: 'option-c',
      label: 'Option C — Relax Today',
      labelAr: 'الخيار ج — استجمام وروقان اليوم',
      title: 'Free Morning & Spa Credits',
      titleAr: 'صباح استجمام حر وسبا ع البحر',
      timeSlot: 'Flexible',
      timeSlotAr: 'وقت مرن ومفتوح',
      dayLabel: 'Today · Flexible',
      dayLabelAr: 'اليوم (اليوم ٢) · وقتك حر',
      badge: 'More flexible',
      badgeAr: 'أكثر مرونة',
      badgeStyle: 'amber',
      description: 'Take a slow, relaxed morning at your accommodation and lagoon cafes with full flexible credit.',
      descriptionAr: 'استمتع بصباح رايق على ممشى اللايتهاوس وكافيهات الشاطئ، مع رصيد مسترد كامل لأي نشاط لاحق.',
      keyPoints: [
        'Zero schedule pressure today',
        'Full activity credit saved to your trip account',
        'Keeps your 03:00 PM desert quad tour completely intact',
      ],
      keyPointsAr: [
        'بدون أي التزامات زمنية أو استعجال اليوم',
        'رصيد كامل محفوظ في حساب رحلتك لأي تجربة قادمة',
        'يحافظ على نشاط سفاري العصر في ميعاده بدقة',
      ],
    },
  ];

  const currentOption = alternatives.find(a => a.id === selectedOptionId) || alternatives[0];

  const handleSelectOption = (optionId: AlternativeOptionId) => {
    setSelectedOptionId(optionId);
  };

  const handleRebookingConfirmation = () => {
    if (currentOption.hasConflict && conflictResolutionChoice === 'unresolved') {
      setIsConflictModalOpen(true);
      return;
    }

    setRebookingStep('processing');
    setTimeout(() => {
      // Execute concrete Trip OS state shifts & Escrow settlement updates
      if (selectedOptionId === 'option-a') {
        shiftActivityBetweenDays('act-boat-trip-day2', 2, 3, '10:00 AM');
        recordLedgerEntry({
          transactionId: `TXN-REC-WTR-${Date.now().toString().slice(-4)}`,
          idempotencyKey: `IDEMP-WTR-OPT-A-${Date.now()}`,
          bookingRef: 'DHB-REC-BOAT-02',
          tripId: recoveryTripId,
          type: 'REFUND_ISSUED',
          amountEGP: 0,
          debitAccount: 'PLATFORM_ESCROW_MAIN',
          creditAccount: 'TRAVELER_ESCROW_HOLD',
          currency: 'EGP',
          status: 'SETTLED',
          metadata: {
            serviceType: 'boat',
            supplierId: 'SUP-BOAT-01',
            travelerName: profile.name || '—',
            reason: 'Weather Zero-Penalty Reschedule: Boat trip moved to Day 3 10:00 AM'
          }
        });
      } else if (selectedOptionId === 'option-b') {
        updateActivityInDay(2, 'act-boat-trip-day2', {
          title: 'Desert Canyon & Mountain Trek',
          time: '11:30 AM',
          location: 'Wadi Qnai & Dahab Canyons',
          notes: 'Weather adjustment: Inland canyon trek with Bedouin tea'
        });
        if (conflictResolutionChoice === 'move_safari') {
          updateActivityInDay(2, 'act-quad-safari-day2', {
            time: '04:00 PM',
            notes: 'Re-timed for smooth canyon buffer'
          });
        }
        recordLedgerEntry({
          transactionId: `TXN-REC-WTR-${Date.now().toString().slice(-4)}`,
          idempotencyKey: `IDEMP-WTR-OPT-B-${Date.now()}`,
          bookingRef: 'DHB-REC-CANYON-02',
          tripId: recoveryTripId,
          type: 'PAYMENT_CAPTURED',
          amountEGP: 0,
          debitAccount: 'PLATFORM_ESCROW_MAIN',
          creditAccount: 'SUPPLIER_BEDOUIN_HOLD',
          currency: 'EGP',
          status: 'SETTLED',
          metadata: {
            serviceType: 'canyon',
            supplierId: 'SUP-BEDOUIN-02',
            travelerName: profile.name || '—',
            reason: 'Weather Zero-Penalty Swap: Canyon Trek substituted for Boat Trip'
          }
        });
      } else if (selectedOptionId === 'option-c') {
        updateActivityInDay(2, 'act-boat-trip-day2', {
          title: 'Free Morning & Lighthouse Palapa Spa',
          time: 'Flexible',
          location: 'Lighthouse Bay, Dahab',
          notes: 'Full escrow credit preserved in Dahab OS wallet'
        });
        recordLedgerEntry({
          transactionId: `TXN-REC-WTR-${Date.now().toString().slice(-4)}`,
          idempotencyKey: `IDEMP-WTR-OPT-C-${Date.now()}`,
          bookingRef: 'DHB-REC-CREDIT-02',
          tripId: recoveryTripId,
          type: 'REFUND_ISSUED',
          amountEGP: 1200,
          debitAccount: 'PLATFORM_ESCROW_MAIN',
          creditAccount: 'TRAVELER_WALLET_BALANCE',
          currency: 'EGP',
          status: 'SETTLED',
          metadata: {
            serviceType: 'credit',
            supplierId: 'PLATFORM_DURABLE_ESCROW',
            travelerName: profile.name || '—',
            reason: 'Weather Recovery: 1,200 EGP Escrow Credit returned to wallet'
          }
        });
      }

      setRebookingStep('success');
      if (onTripUpdated) {
        onTripUpdated({
          activity: currentOption.title,
          newTime: currentOption.timeSlot,
          day: currentOption.dayLabel,
        });
      }
      showToast(
        t('recovery.confirmedUpdatedCoordinators', { title: language === 'ar' ? currentOption.titleAr : currentOption.title })
      );
    }, 1200);
  };

  const handleResolveConflict = () => {
    setConflictResolutionChoice('move_safari');
    setIsConflictModalOpen(false);
    showToast(
      t('recovery.quadSafariMovedTo')
    );
  };

  const handleNavigate = (tab: 'home' | 'mytrip' | 'explore' | 'bookings' | 'profile') => {
    setActiveNavTab(tab);
    if (tab === 'home' || tab === 'mytrip') {
      onBackToMyTrip();
    } else if (tab === 'explore' && onExploreClick) {
      onExploreClick();
    } else if (tab === 'bookings') {
      onBackToMyTrip();
    } else if (tab === 'profile') {
      showToast('Logged in as Ahmed (ahmed.traveler@example.com)');
    }
  };

  return (
    <div 
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--surface-card)] text-[var(--text-primary)] flex flex-col pb-28 md:pb-16 selection:bg-[var(--accent-secondary)]/20"
    >
      {/*
        This view had no <h1> at all — its only h2s are the two conditional
        state messages ("Today's boat trip won't be as pleasant…" /
        "We've fixed your day"), so the page had no stable identity for
        assistive tech or search. Visually hidden because the design
        deliberately leads with the disruption message, not a page title.
      */}
      <h1 className="sr-only">
        {t('recovery.tripChangesRecovery')}
      </h1>

      {/* Traveler Top Navigation */}
      <TravelerNav
        activeTab={activeNavTab}
        onNavigate={handleNavigate}
        onOpenHelp={() => onOpenHelp && onOpenHelp('boat-trip-reschedule')}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full flex-grow">
        
        {/* Top Breadcrumb */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="back-to-companion-btn"
              onClick={onBackToCompanion || onBackToMyTrip}
              className="inline-flex items-center gap-1.5 py-3.5 -my-2 text-xs font-semibold text-[var(--text-secondary)]/70 hover:text-[var(--accent-secondary)] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              <span>{t('recovery.backToDailyCompanion')}</span>
            </button>
            <span className="text-[var(--text-muted)]">•</span>
            <span className="text-xs font-bold text-[var(--accent-secondary)]">
              {t('recovery.smartPlanRecovery')}
            </span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('recovery.activePlanProtection')}</span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* REBOOKING STATE FLOW                                         */}
        {/* ============================================================ */}

        {rebookingStep === 'success' ? (
          /* SUCCESS CONFIRMATION VIEW */
          <div className="max-w-3xl mx-auto bg-[var(--surface-card)] rounded-3xl p-7 sm:p-9 border-2 border-emerald-500/50 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center text-2xl shadow-xs">
                ✓
              </div>
              <div>
                <span className="text-[11px] font-black text-emerald-400 block">
                  {t('recovery.planSuccessfullyUpdated')}
                </span>
                <h2 className="text-2xl sm:text-3xl chart-heading font-bold text-[var(--text-primary)]">
                  {t('recovery.weveFixedYourDay')}
                </h2>
              </div>
            </div>

            <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed font-medium">
              {t('recovery.lockedIntoSchedule', { title: language === 'ar' ? currentOption.titleAr : currentOption.title })}
            </p>

            {/* Confirmed Details Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold text-[var(--accent-secondary)]">{t('recovery.newConfirmedActivity')}</span>
                  <h3 className="chart-heading font-bold text-lg text-[var(--text-primary)]">
                    {language === 'ar' ? currentOption.titleAr : currentOption.title}
                  </h3>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40">
                  {t('recovery.confirmed')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[var(--text-secondary)]">
                <div>
                  <span className="text-[var(--text-secondary)]/60 block font-semibold">{t('recovery.scheduledTime')}</span>
                  <span className="font-bold text-[var(--text-primary)]">{language === 'ar' ? currentOption.dayLabelAr : currentOption.dayLabel}</span>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]/60 block font-semibold">{t('recovery.location')}</span>
                  <span className="font-bold text-[var(--text-primary)]">{t('recovery.dahabMarinaReefs')}</span>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]/60 block font-semibold">{t('recovery.coordination')}</span>
                  <span className="font-bold text-emerald-400">{t('recovery.automatedSkipperNotified')}</span>
                </div>
              </div>
            </div>

            {/* Timeline Preview */}
            <div className="space-y-3">
              <h3 className="text-base chart-heading font-bold text-[var(--text-primary)]">
                {t('recovery.updatedTripTimeline')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-2">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
                    <span className="text-xs font-bold text-[var(--accent-secondary)]">{t('recovery.todayDay2')}</span>
                    <span className="text-[11px] text-[var(--text-secondary)]/60">Oct 13</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                    <div className="flex items-center justify-between text-[var(--text-secondary)]/70">
                      <span>09:00 AM</span>
                      <span>{t('recovery.breakfast')}</span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-300 font-bold bg-emerald-950/40 p-2 rounded-xl border border-emerald-500/30">
                      <span>11:30 AM</span>
                      <span className="inline-flex items-center gap-1"><CategoryIcon kind="sparkles" className="w-3.5 h-3.5" /> {t('recovery.freeTimeBeachWalk')}</span>
                    </div>
                    <div className="flex items-center justify-between text-[var(--text-secondary)]/70">
                      <span>01:00 PM</span>
                      <span>{t('recovery.lunchByTheBay')}</span>
                    </div>
                    <div className="flex items-center justify-between text-[var(--text-secondary)]/70">
                      <span>03:00 PM</span>
                      <span>{t('recovery.desertQuadSafari')}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-2">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
                    <span className="text-xs font-bold text-[var(--accent-secondary)]">{t('recovery.tomorrowDay3')}</span>
                    <span className="text-[11px] text-[var(--text-secondary)]/60">Oct 14</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                    <div className="flex items-center justify-between text-[var(--text-secondary)]/70">
                      <span>09:00 AM</span>
                      <span>{t('recovery.breakfast-2')}</span>
                    </div>
                    <div className="flex items-center justify-between text-[var(--text-primary)] font-bold bg-[var(--surface-card)] p-2 rounded-xl border border-[var(--accent-secondary)]/40 text-[var(--accent-secondary)]">
                      <span>10:00 AM</span>
                      <span className="flex items-center gap-1.5"><Sailboat className="w-3.5 h-3.5" />{t('recovery.boatTripRescheduled')}</span>
                    </div>
                    <div className="flex items-center justify-between text-[var(--text-secondary)]/70">
                      <span>01:30 PM</span>
                      <span>{t('recovery.seafoodLunch')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Back Button */}
            <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                id="view-updated-itinerary-btn"
                onClick={onBackToCompanion || onBackToMyTrip}
                className="px-6 py-3 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-bold shadow-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center gap-2 cursor-pointer active:scale-98"
              >
                <span>{t('recovery.returnToDailyCompanion')}</span>
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </button>

              <button
                type="button"
                onClick={() => setRebookingStep('viewing')}
                className="text-xs font-semibold text-[var(--text-secondary)]/70 hover:text-[var(--accent-secondary)] transition-colors cursor-pointer"
              >
                {t('recovery.reviewOtherAlternativesAgain')}
              </button>
            </div>
          </div>
        ) : (
          /* ACTIVE RECOVERY WORKFLOW (7/12 vs 5/12 Layout) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* MAIN COLUMN (7/12) */}
            <div className="lg:col-span-7 space-y-6">

              {/* 1. ALERT & REASSURANCE BANNER */}
              <section id="change-alert-card" className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-amber-500/40 shadow-xl space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center flex-shrink-0 shadow-xs">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {observedLabel
                          ? t('recovery.marineReading', { observedLabel })
                          : t('recovery.changeOfPlan')}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl chart-heading font-bold text-[var(--text-primary)]">
                      {isChoppy
                        ? t('recovery.windNotComfortable', { knots: wind!.knots })
                        : t('recovery.wantToChangeSomething')}
                    </h2>
                    <p className="text-xs sm:text-sm text-emerald-300 font-semibold flex items-center gap-1.5 pt-0.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>
                        {t('recovery.threeAlternativesNoCharge', {
                          lead: language === 'ar'
                            ? (travelerFirstName ? t('recovery.nameLeadAr', { name: travelerFirstName }) : '')
                            : (travelerFirstName ? `${travelerFirstName}, t` : 'T'),
                        })}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Weather details */}
                <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-2 text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Waves className="w-4 h-4 text-cyan-400" />
                      <span>{t('recovery.seaCondition')}</span>
                    </span>
                    {/* Was "24 knots · 1.4m chop" — a wind speed and a wave
                        height, neither observed, on the page a traveler reads
                        to decide whether to go out on the water. Wave height is
                        still not reported: nothing measures it here. */}
                    <span className="font-mono text-amber-300 font-bold">
                      {wind
                        ? `${wind.knots} kn ${wind.direction}`
                        : t('live.readingUnavailable')}
                    </span>
                  </div>
                  <p className="text-[var(--text-secondary)]/70 leading-relaxed">
                    {isChoppy
                      ? t('recovery.thisWindMakesDeep')
                      : t('recovery.marineConditionsAreNormal')}
                  </p>
                </div>
              </section>

              {/* 2. 3 CURATED ALTERNATIVES */}
              <section id="alternatives-section" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl chart-heading font-bold text-[var(--text-primary)]">
                    {t('recovery.chooseYourBestAlternative')}
                  </h3>
                  <span className="text-xs text-[var(--text-secondary)]/60">
                    {t('recovery.3EvaluatedOptions')}
                  </span>
                </div>

                <div className="space-y-3.5">
                  {alternatives.map((alt) => {
                    const isSelected = selectedOptionId === alt.id;
                    return (
                      <button
                        key={alt.id}
                        type="button"
                        onClick={() => handleSelectOption(alt.id)}
                        aria-pressed={isSelected}
                        className={`w-full text-start rounded-3xl p-5 sm:p-6 border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer space-y-3 ${
                          isSelected
                            ? 'bg-[var(--surface-container)] border-2 border-[var(--accent-secondary)] shadow-[0_0_20px_rgba(244,195,108,0.15)] ring-1 ring-[var(--accent-secondary)]/30'
                            : 'bg-[var(--surface-card)] hover:bg-[var(--surface-container)] border-[var(--border-subtle)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full ${
                              alt.badgeStyle === 'emerald'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : alt.badgeStyle === 'amber'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            }`}>
                              {language === 'ar' ? alt.badgeAr : alt.badge}
                            </span>
                            <span className="text-xs font-bold text-[var(--text-secondary)]">
                              {language === 'ar' ? alt.labelAr : alt.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-[var(--accent-secondary)] font-bold">{language === 'ar' ? alt.dayLabelAr : alt.dayLabel}</span>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                              isSelected ? 'bg-[var(--accent-secondary)] border-[var(--accent-secondary)] text-[var(--surface-card)]' : 'border-[var(--border-subtle)]'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-lg chart-heading font-bold text-[var(--text-primary)]">
                            {language === 'ar' ? alt.titleAr : alt.title}
                          </h4>
                          <p className="text-xs sm:text-sm text-[var(--text-secondary)]/80 leading-relaxed">
                            {language === 'ar' ? alt.descriptionAr : alt.description}
                          </p>
                        </div>

                        {/* Bullet points */}
                        <div className="space-y-1 text-xs text-[var(--text-secondary)]/70 pt-1">
                          {(language === 'ar' ? alt.keyPointsAr : alt.keyPoints).map((pt, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="text-emerald-400 text-xs">✓</span>
                              <span>{pt}</span>
                            </div>
                          ))}
                        </div>

                        {alt.hasConflict && (
                          <div className="p-3 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200 space-y-1">
                            <span className="font-bold flex items-center gap-1 text-amber-300">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{t('recovery.scheduleConflictNotice')}</span>
                            </span>
                            <p>{language === 'ar' ? alt.conflictDetails?.explanationAr : alt.conflictDetails?.explanation}</p>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 3. PRIMARY REBOOK CTA */}
              <div className="p-6 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-[var(--accent-secondary)]">{t('recovery.selectedAlternative')}</span>
                    <h4 className="chart-heading font-bold text-base text-[var(--text-primary)]">
                      {language === 'ar' ? currentOption.titleAr : currentOption.title}
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">{language === 'ar' ? currentOption.dayLabelAr : currentOption.dayLabel}</span>
                </div>

                <button
                  type="button"
                  id="confirm-rebooking-btn"
                  onClick={handleRebookingConfirmation}
                  className="w-full py-3.5 px-6 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-bold shadow-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <RefreshCw className="w-4 h-4 text-[var(--surface-card)]" />
                  <span>{t('recovery.confirmApplyThisPlan', { title: language === 'ar' ? currentOption.titleAr : '' })}</span>
                </button>

                <p className="text-[12px] text-center text-[var(--text-secondary)]/60">
                  {t('recovery.youDontNeedTo')}
                </p>
              </div>

            </div>

            {/* SECONDARY SIDEBAR (5/12) */}
            <div className="lg:col-span-5 space-y-6">

              {/* 1. PEACE OF MIND GUARANTEE */}
              <div className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xl space-y-4">
                <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="chart-heading font-bold text-base text-[var(--text-primary)]">
                    {t('recovery.automatedCoordination')}
                  </h3>
                </div>

                <p className="text-xs sm:text-sm text-[var(--text-secondary)]/80 leading-relaxed">
                  {t('recovery.anyScheduleChangeIs')}
                </p>

                <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{t('recovery.boatMarinaNotified')}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{t('recovery.privateDriverScheduleSynced')}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{t('recovery.afternoonActivities100Protected')}</span>
                  </div>
                </div>
              </div>

              {/* 2. NEED HUMAN EXPERT? */}
              <div className="bg-[var(--surface-container)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xl space-y-3.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[var(--accent-secondary)]" />
                  <h4 className="chart-heading font-bold text-base text-[var(--text-primary)]">
                    {t('recovery.needExpertAdvice')}
                  </h4>
                </div>

                <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed">
                  {t('recovery.ourLocalDahabTrip')}
                </p>

                <button
                  type="button"
                  onClick={() => onOpenHelp && onOpenHelp('boat-weather')}
                  className="w-full py-2.5 px-4 rounded-full bg-[var(--surface-card)] hover:bg-[var(--surface-container)] text-[var(--accent-secondary)] font-bold text-xs border border-[var(--accent-secondary)]/40 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
                >
                  {t('recovery.chatWithDahabExpert')}
                </button>
              </div>

            </div>

          </div>
        )}

      </main>

      {/* CONFLICT RESOLUTION MODAL */}
      {isConflictModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="bg-[var(--surface-card)] rounded-3xl max-w-md w-full p-6 sm:p-7 border border-amber-500/50 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-primary)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2 text-amber-300">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base chart-heading font-bold text-[var(--text-primary)]">
                  {t('recovery.scheduleConflictDetected')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConflictModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-full hover:bg-[var(--btn-util-bg)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {t('recovery.canyonTrekFinishesAt')}
            </p>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleResolveConflict}
                className="w-full py-2.5 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
              >
                {t('recovery.shiftQuadTourTo')}
              </button>
              <button
                type="button"
                onClick={() => setIsConflictModalOpen(false)}
                className="w-full py-2 rounded-full bg-transparent hover:bg-[var(--btn-util-bg)] text-[var(--text-secondary)]/70 text-xs font-semibold cursor-pointer"
              >
                {t('recovery.cancelAndChooseAnother')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--surface-container)] text-[var(--text-primary)] border border-[var(--accent-secondary)]/40 px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};

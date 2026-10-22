import React, { useState } from 'react';
import { 
  Plane, 
  Car, 
  Building, 
  Clock, 
  Luggage, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  MessageSquare, 
  MapPin, 
  ShieldCheck, 
  Utensils, 
  Coffee, 
  ArrowRight, 
  Sparkles, 
  Compass,
  FileText,
  QrCode,
  X,
  Share2,
  Gift
} from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';

export const DepartureView: React.FC = () => {
  const { profile, user, navigateTo, showToast, activeTrip, activeTripItems, bookings } = useTrip();

  /**
   * The departure day, built from what this traveler actually booked.
   *
   * It used to be a fixed script: check-out at 11:00 marked "Completed ✓", bags
   * stored at 11:30, a farewell lunch, a last walk, a private car at 05:00, and
   * "Departure Flight MS 305" at 06:20 PM — with a flight tracker showing
   * SSH → CAI, Terminal 1, Gate 4 and "On Time ✓". Every traveler saw the same
   * day, on whatever date, and none of it had a source: this platform has never
   * collected a flight number, and nothing tracks a flight.
   *
   * A step appears here only when there is a booking behind it.
   */
  const departureTransfer = [...bookings]
    .filter(b => b.serviceType === 'transfer')
    // The last transfer on the trip is the one out.
    .sort((a, b) => a.datesOrTime.localeCompare(b.datesOrTime))
    .pop();
  const hotel = bookings.find(b => b.serviceType === 'hotel');
  /** Only if a booking carries one — BookingEntity.flightNumber is optional. */
  const flightNumber = activeTripItems.find(i => i.metadata?.flightNumber)?.metadata?.flightNumber as
    | string
    | undefined;
  const { language, isRTL, t } = useLanguage();

  const travelerName = profile.name || user?.displayName || (t('departure.traveler'));

  // Checklist items
  const [checklist, setChecklist] = useState(() => [
    { 
      id: 'c1', 
      label: 'Hotel room key returned to front desk', 
      labelAr: 'تسليم كارت الأوضة للريسبشن وتصفية الحسابات', 
      done: true 
    },
    { 
      id: 'c2', 
      label: 'Luggage tagged & stored safely with concierge', 
      labelAr: 'تسليم الشنط للأمانات واستلام إيصال الحفظ الإلكتروني', 
      done: true 
    },
    { 
      id: 'c3', 
      label: 'Passport & flight boarding pass ready', 
      labelAr: 'البطاقة / الباسبور وتذكرة طيران الرجوع جاهزة ع الموبايل', 
      done: true 
    },
    { 
      id: 'c4', 
      label: 'Diving logbook stamped by instructor', 
      labelAr: 'ختم لوج بوك الغطسات من الكابتن في مركز الغوص', 
      done: true 
    },
    { 
      id: 'c5', 
      label: 'Local Sinai herbs (Habak, Marmareya) & dates packed', 
      labelAr: 'أعشاب سيناء (حبق، مرمية، زيت زيتون بدوي) متغلفة في الشنطة', 
      done: false 
    },
  ]);

  const [showLuggageTicket, setShowLuggageTicket] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);

  const toggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  interface DepartureStep {
    time: string;
    timeAr: string;
    title: string;
    titleAr: string;
    status: string;
    statusAr: string;
    icon: string;
    desc: string;
    descAr: string;
    isDone: boolean;
    isCurrent?: boolean;
  }

  const TIMELINE_ICONS: Record<string, React.ReactNode> = {
    hotel: <Building className="w-5 h-5 text-[var(--accent-secondary)]" />,
    car: <Car className="w-5 h-5 text-[var(--accent-secondary)]" />,
    plane: <Plane className="w-5 h-5 text-[var(--accent-secondary)]" />,
    luggage: <Luggage className="w-5 h-5 text-[var(--accent-secondary)]" />,
  };

  const timelineSteps: DepartureStep[] = [];

  if (hotel) {
    timelineSteps.push({
      time: hotel.datesOrTime,
      timeAr: hotel.datesOrTime,
      title: 'Hotel checkout',
      titleAr: 'تسليم الغرفة',
      // Not reported as done: nothing here tracks a check-out.
      status: hotel.provider,
      statusAr: hotel.provider,
      icon: 'hotel',
      desc: `${hotel.subtitle} · ${hotel.confirmationCode}`,
      descAr: `${hotel.subtitle} · ${hotel.confirmationCode}`,
      isDone: false
    });
  }

  if (departureTransfer) {
    timelineSteps.push({
      time: departureTransfer.datesOrTime,
      timeAr: departureTransfer.datesOrTime,
      title: 'Airport transfer',
      titleAr: 'عربية المطار',
      status: departureTransfer.status,
      statusAr: departureTransfer.status,
      icon: 'car',
      desc: [departureTransfer.provider, departureTransfer.confirmationCode, departureTransfer.location]
        .filter(Boolean)
        .join(' · '),
      descAr: [departureTransfer.provider, departureTransfer.confirmationCode, departureTransfer.location]
        .filter(Boolean)
        .join(' · '),
      isDone: false,
      isCurrent: true
    });
  }

  if (flightNumber) {
    timelineSteps.push({
      time: '',
      timeAr: '',
      title: `Departure flight ${flightNumber}`,
      titleAr: `رحلة العودة ${flightNumber}`,
      // No status, gate or terminal — nothing here tracks a flight.
      status: '',
      statusAr: '',
      icon: 'plane',
      desc: '',
      descAr: '',
      isDone: false
    });
  }

  return (
    <div 
      id="departure-mode-view" 
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--surface-card)] text-[var(--text-primary)] pb-24 selection:bg-[var(--accent-secondary)]/30"
    >
      {/* 1. Coordinated Departure Header */}
      <section className="bg-[var(--surface-card)] border-b border-[var(--border-subtle)] text-white pt-10 pb-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-container)] border border-[var(--accent-secondary)]/30 text-xs font-bold text-[var(--accent-secondary)]">
                <Plane className="w-3.5 h-3.5" />
                <span>{t('departure.departureDayOctober16')}</span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[var(--text-primary)] tracking-tight text-balance">
                {t('departure.headingHome', { travelerName })}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]/80 max-w-2xl font-medium leading-relaxed">
                {t('departure.yourEntireDepartureDay')}
              </p>
            </div>

            {/* Live Buffer Countdown */}
            <div className="p-5 rounded-3xl bg-[var(--surface-container)] border border-[var(--accent-secondary)]/30 text-center sm:text-start space-y-1 shadow-lg">
              <span className="text-[11px] font-black text-[var(--accent-secondary)] block">
                {t('departure.timeUntilAirportPickup')}
              </span>
              {/* Was a frozen "02h : 18m" beside "Driver arriving at 02:30 PM",
                  shown at every hour of every day. */}
              <div className="text-2xl sm:text-3xl font-mono font-bold text-[var(--text-primary)]">
                {departureTransfer?.datesOrTime || '—'}
              </div>
              <span className="text-[12px] text-[var(--text-secondary)]/70 block">
                {departureTransfer
                  ? t('departure.transferTime', { provider: departureTransfer.provider })
                  : t('departure.noAirportTransferBooked')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (7/12): Departure Timeline */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-8 border border-[var(--border-subtle)] shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                <div>
                  <span className="text-[11px] font-black text-[var(--accent-secondary)] block">
                    {t('departure.coordinatedSchedule')}
                  </span>
                  <h2 className="chart-heading font-bold text-xl text-[var(--text-primary)]">
                    {t('departure.todaysDepartureTimeline')}
                  </h2>
                </div>

                <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30">
                  {t('departure.onTrack')}
                </span>
              </div>

              {/* Timeline Steps */}
              <div className={`space-y-4 relative before:absolute ${isRTL ? 'before:right-5' : 'before:left-5'} before:top-4 before:bottom-4 before:w-0.5 before:bg-[var(--btn-util-bg)]`}>
                {timelineSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className={`relative flex items-start gap-4 p-4 rounded-2xl transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                      step.isCurrent
                        ? 'bg-[var(--surface-container)] border-2 border-[var(--accent-secondary)] shadow-[0_0_20px_rgba(244,195,108,0.15)] ring-1 ring-[var(--accent-secondary)]/30'
                        : step.isDone
                        ? 'bg-[var(--surface-container)]/40 opacity-80 border border-[var(--border-subtle)]'
                        : 'bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] shadow-xs flex items-center justify-center flex-shrink-0 relative z-10">
                      {TIMELINE_ICONS[step.icon] ?? null}
                    </div>

                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[var(--accent-secondary)]">
                            {language === 'ar' ? step.timeAr : step.time}
                          </span>
                          <h3 className="font-bold text-sm text-[var(--text-primary)]">
                            {language === 'ar' ? step.titleAr : step.title}
                          </h3>
                        </div>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          step.isCurrent
                            ? 'bg-[var(--accent-secondary)] text-[var(--surface-card)] font-extrabold'
                            : step.isDone
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-[var(--btn-util-bg)] text-[var(--text-secondary)]'
                        }`}>
                          {language === 'ar' ? step.statusAr : step.status}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]/70 leading-relaxed font-normal">
                        {language === 'ar' ? step.descAr : step.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/*
              The flight card, shown only if a booking carries a flight number.

              It was a full tracker: "Flight MS 305 Status", "On Time ✓",
              SSH → CAI, "Departure: 06:20 PM", "Terminal 1", "Gate 4". This
              platform has never collected a flight number and nothing here
              queries an airline — every one of those values was written into
              the file, and a traveler reading "On Time ✓" had been told
              something nobody had checked.
            */}
            {flightNumber && (
              <div className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xl space-y-3">
                <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                  <Plane className="w-4 h-4 text-[var(--accent-secondary)]" />
                  <h2 className="chart-heading font-bold text-base text-[var(--text-primary)]">
                    {t('departure.departureFlight', { flightNumber })}
                  </h2>
                </div>
                <p className="text-xs text-[var(--text-secondary)]/70 leading-relaxed">
                  {t('departure.checkTheStatusAnd')}
                </p>
              </div>
            )}

            {/* Luggage Storage Pass Button */}
            <div className="p-5 rounded-3xl bg-[var(--surface-container)] border border-[var(--accent-secondary)]/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[var(--surface-card)] text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/30 flex items-center justify-center font-bold">
                  <Luggage className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[var(--text-primary)]">
                    {t('departure.digitalLuggageStoragePass')}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]/70">
                    {t('departure.2LargeBags1')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLuggageTicket(true)}
                className="px-4 py-2 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center gap-1.5 whitespace-nowrap shadow-xs"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{t('departure.viewPass')}</span>
              </button>
            </div>
          </div>

          {/* Right Column (5/12): Transfer Driver & Departure Checklist */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* 1. Confirmed Driver Card */}
            <div className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-[var(--accent-secondary)]" />
                  <h2 className="chart-heading font-bold text-base text-[var(--text-primary)]">
                    {t('departure.airportTransferDriver')}
                  </h2>
                </div>
                <span className="text-xs font-bold text-[var(--accent-secondary)] bg-[var(--surface-container)] border border-[var(--accent-secondary)]/30 px-2.5 py-0.5 rounded-full">
                  {departureTransfer?.datesOrTime || (t('departure.noTransferBooked'))}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[var(--surface-container)] flex items-center justify-center text-[var(--accent-secondary)] border border-[var(--border-subtle)]">
                  <Car className="w-7 h-7" />
                </div>
                {/*
                  Was "Captain Youssef", "Silver Toyota HiAce (A/C)" and plate
                  "ط ج د 4921" — a named driver and a vehicle, on every
                  traveler's screen, for a booking no supplier had yet accepted.
                  A booking now starts at PENDING_CONFIRMATION and carries no
                  assignment until the supplier makes one.
                */}
                <div>
                  <h3 className="font-bold text-base text-[var(--text-primary)]">
                    {departureTransfer?.details && departureTransfer.details !== '—'
                      ? departureTransfer.details
                      : t('departure.noDriverAssignedYet')}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]/70">
                    {departureTransfer?.provider || (language === 'ar' ? '—' : '—')}
                  </p>
                  {departureTransfer?.confirmationCode && (
                    <p className="text-[12px] font-mono text-[var(--accent-secondary)] font-bold mt-0.5">
                      {departureTransfer.confirmationCode}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    departureTransfer?.phone
                      ? window.open(`tel:${departureTransfer.phone}`, '_self')
                      : showToast(
                          t('departure.noContactNumberFor')
                        )
                  }
                  className="py-2.5 px-3 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{t('departure.callDriver')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => showToast(t('departure.chatOpenedWithSinai'))}
                  className="py-2.5 px-3 rounded-full border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--btn-util-bg)] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{t('departure.message')}</span>
                </button>
              </div>
            </div>

            {/* 2. Departure Checklist */}
            <div className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h2 className="chart-heading font-bold text-base text-[var(--text-primary)]">
                    {t('departure.departureChecklist')}
                  </h2>
                </div>
                <span className="text-xs text-[var(--text-secondary)]/50 font-bold">
                  {checklist.filter((c) => c.done).length} / {checklist.length} {t('daygi.done')}
                </span>
              </div>

              <div className="space-y-2">
                {checklist.map((item) => {
                  const label = language === 'ar' ? item.labelAr : item.label;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleChecklist(item.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[var(--surface-container)] text-start transition-colors cursor-pointer border border-[var(--border-subtle)]"
                    >
                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                          item.done
                            ? 'bg-emerald-500 text-[var(--surface-card)]'
                            : 'border-2 border-[var(--border-subtle)] bg-transparent'
                        }`}
                      >
                        {item.done && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          item.done ? 'line-through text-[var(--text-secondary)]/40' : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Completed Trip / Post-Trip Review Shortcut */}
            <div className="p-6 rounded-3xl bg-[var(--surface-container)] border border-[var(--accent-secondary)]/30 text-white shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-secondary)]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('departure.tripConclusion')}</span>
              </div>
              <h3 className="chart-heading font-bold text-lg text-[var(--text-primary)]">
                {t('departure.lookingBackAtYour')}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed">
                {t('departure.whenYouReturnHome')}
              </p>
              <button
                type="button"
                onClick={() => navigateTo('/post-trip')}
                className="w-full py-2.5 px-4 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>{t('departure.viewCompletedTripHub')}</span>
                <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
              </button>
            </div>

          </div>

        </div>
      </main>

      {/* Luggage Ticket Modal */}
      {showLuggageTicket && (
        <div 
          dir={isRTL ? 'rtl' : 'ltr'}
          role="dialog"
          aria-modal="true"
          aria-label={t('departure.luggageStorageReceipt')}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-[var(--surface-card)] rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[var(--border-subtle)] space-y-5 text-center animate-in zoom-in-95 duration-200 text-[var(--text-primary)]">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <span className="text-xs font-bold text-[var(--accent-secondary)]">
                {t('departure.luggageStorageReceipt')}
              </span>
              <button
                type="button"
                onClick={() => setShowLuggageTicket(false)}
                className="text-[var(--text-secondary)]/60 hover:text-[var(--text-primary)] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-dashed border-[var(--accent-secondary)]/40 space-y-3">
              <div className="w-32 h-32 mx-auto bg-[var(--surface-card)] rounded-xl p-2 border border-[var(--border-subtle)] flex items-center justify-center">
                <QrCode className="w-24 h-24 text-[var(--surface-card)]" />
              </div>
              <div>
                <span className="text-[12px] text-[var(--text-secondary)]/60 block">{t('departure.claimCode')}</span>
                <span className="text-lg font-mono font-bold text-[var(--accent-secondary)]">DHB-LUG-{activeTrip?.id?.slice(-3) || '—'}-02</span>
              </div>
            </div>

            <div className="text-xs text-[var(--text-secondary)]/80 space-y-1 text-start">
              <p><strong className="text-[var(--text-primary)]">{t('departure.guest')}</strong> {travelerName}</p>
              <p><strong className="text-[var(--text-primary)]">{t('departure.totalPieces')}</strong> 3 (2 Bags + 1 Dive Gear)</p>
              <p><strong className="text-[var(--text-primary)]">{t('departure.pickupTime')}</strong> 02:30 PM (Lobby)</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowLuggageTicket(false);
                showToast(t('departure.luggagePassSavedTo'));
              }}
              className="w-full py-2.5 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-bold cursor-pointer transition-colors"
            >
              {t('departure.done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

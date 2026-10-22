import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Clock, 
  Calendar, 
  MapPin, 
  ShieldCheck, 
  AlertTriangle, 
  Sparkles, 
  MessageSquare, 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  CheckCircle2, 
  RefreshCw, 
  PhoneCall, 
  Car, 
  Building2, 
  Utensils, 
  Compass, 
  ChevronRight,
  User, 
  FileText, 
  X, 
  UserCheck, 
  Navigation,
  Mail,
  LocateFixed,
  PhoneForwarded,
  Waves,
  Bike,
  BedDouble,
  CalendarDays,
  MessageCircle,
  Sailboat
} from 'lucide-react';
import { TravelerNav } from '../mytrip/TravelerNav';
import { useTrip } from '../../context/TripContext';
import { api } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { sanitizeText } from '../../utils/sanitize';

export type HelpCategory = 'booking' | 'transport' | 'food' | 'hotel' | 'activity' | 'other';

export type HelpStep = 
  | 'categories' 
  | 'select_booking' 
  | 'specific_issue' 
  | 'custom_input' 
  | 'diagnosis' 
  | 'self_service_result' 
  | 'escalate_expert' 
  | 'expert_chat' 
  | 'resolved' 
  | 'in_progress';

interface HelpMeNowViewProps {
  onBackToMyTrip: () => void;
  onBackToCompanion?: () => void;
  onNavigateToChangeRecovery?: () => void;
  onNavigateToArrival?: () => void;
  onExploreClick?: () => void;
  initialCategory?: HelpCategory;
  initialTopic?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'ahmed' | 'expert';
  senderName: string;
  senderNameAr: string;
  text: string;
  textAr: string;
  time: string;
  attachment?: string;
}

export const HelpMeNowView: React.FC<HelpMeNowViewProps> = ({
  onBackToMyTrip,
  onBackToCompanion,
  onNavigateToChangeRecovery,
  onNavigateToArrival,
  onExploreClick,
  initialCategory,
  initialTopic,
}) => {
  const { language, isRTL , t} = useLanguage();
  // Every message in this panel used to address the traveler as "Ahmed" in
  // both languages. The name comes from the session now, and is simply omitted
  // when there is none.
  const { profile, user, sessionUser, activeTrip, bookings } = useTrip();
  // Emergency resources fetched from backend
  const [emergencyState, setEmergencyState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [emergencyHotlines, setEmergencyHotlines] = useState<Array<{ service: string; number: string }>>([]);
  const [emergencyError, setEmergencyError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.getEmergencyResources(controller.signal)
      .then((data) => {
        if (data.emergencyHotlines?.length) {
          setEmergencyHotlines(data.emergencyHotlines);
        }
        setEmergencyState('loaded');
      })
      .catch((err) => {
        setEmergencyState('error');
        setEmergencyError(err instanceof Error ? err.message : 'Could not load emergency resources.');
      });
    return () => controller.abort();
  }, []);

  const [isSendingSupport, setIsSendingSupport] = useState<boolean>(false);
  // First name only: a greeting reads as a greeting, not as a record
  // lookup. "جعان يا Ahmed Mansour؟" is not how anyone is addressed.
  const travelerName = (profile.name || user?.displayName || sessionUser?.name || '').trim().split(/\s+/)[0] || '';
  const [activeNavTab, setActiveNavTab] = useState<'home' | 'mytrip' | 'explore' | 'bookings' | 'profile'>('mytrip');
  
  // Current step in the Help Me Now interactive flow
  const [currentStep, setCurrentStep] = useState<HelpStep>(
    initialCategory ? 'specific_issue' : 'categories'
  );

  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | null>(initialCategory || null);
  const [selectedBooking, setSelectedBooking] = useState<string>('');
  const [selectedIssue, setSelectedIssue] = useState<string>(initialTopic || '');
  const [customText, setCustomText] = useState<string>('');
  const [hasPhotoAttached, setHasPhotoAttached] = useState<boolean>(false);

  // Time-sensitive urgency flag
  const [isUrgent, setIsUrgent] = useState<boolean>(false);

  // Live chat messages with the Dahab Expert
  // Starts empty.
  //
  // It used to be seeded with a two-message exchange in which a "Dahab Expert"
  // named Kareem told the traveler their boat booking was already being
  // checked with the captain and would be confirmed within five minutes. There
  // is no support backend of any kind — no endpoint, no queue, no agent — so
  // that was a promise of action nobody was taking, shown to a traveler with a
  // real problem. Whatever is typed here still gets an acknowledgement, but the
  // panel no longer opens by claiming work is under way.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newChatInput, setNewChatInput] = useState<string>('');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  /**
   * The traveler's own bookings, from the trip — never a demo list.
   *
   * This was five hardcoded entries from "Ahmed's current Dahab trip"
   * ("Blue Hole Scuba & Reef Diving, Day 4, Confirmed ✓" and friends) shown
   * to every traveler as their bookings, with the chosen name attached to a
   * real support ticket. Icons come from the booking's own iconType so no
   * emoji stand in for the icon system.
   */
  const BOOKING_ICONS = {
    building: Building2,
    car: Car,
    waves: Waves,
    compass: Compass,
    sparkles: Sparkles,
    utensils: Utensils,
    bike: Bike,
  } as const;
  const activeBookings = bookings.map((b) => ({
    id: b.id,
    name: b.title,
    time: b.datesOrTime || b.subtitle,
    status: b.status.replace(' ✓', ''),
    Icon: BOOKING_ICONS[b.iconType] ?? CalendarDays,
  }));

  // Specific options mapped per category
  const categoryIssues: Record<HelpCategory, { title: string; titleAr: string; options: { en: string; ar: string }[] }> = {
    booking: {
      title: 'What happened with your booking?',
      titleAr: 'إيه المشكلة اللي واجهتك في الحجز؟',
      options: [
        { en: "It's pending", ar: 'الحجز معلق (Pending)' },
        { en: 'I want to change it', ar: 'عايز أغير موعد الحجز' },
        { en: "I can't find it", ar: 'مش لاقي تفاصيل الحجز' },
        { en: 'Something else', ar: 'حاجة تانية' },
      ],
    },
    transport: {
      title: 'What do you need help with?',
      titleAr: 'محتاج مساعدة في إيه بخصوص المواصلات؟',
      options: [
        { en: 'My driver is late', ar: 'السائق اتأخر عن الميعاد' },
        { en: 'Where is my driver?', ar: 'مكان السائق فين دلوقتي؟' },
        { en: "I can't find the pickup point", ar: 'مش لاقي نقطة الركوب' },
        { en: 'I need another ride', ar: 'عايز توصيلة تانية فورية' },
        { en: 'Something else', ar: 'حاجة تانية' },
      ],
    },
    food: {
      title: "What's wrong with your order?",
      titleAr: 'إيه المشكلة في طلب الأكل؟',
      options: [
        { en: 'Order is late', ar: 'الدليفري اتأخر' },
        { en: 'Wrong order', ar: 'الأوردر وصل مختلف' },
        { en: 'Missing item', ar: 'في صنف ناقص' },
        { en: 'Restaurant issue', ar: 'مشكلة مع المطعم' },
        { en: 'Something else', ar: 'حاجة تانية' },
      ],
    },
    hotel: {
      title: 'What happened with the hotel?',
      titleAr: 'إيه المشكلة في الفندق أو الإقامة؟',
      options: [
        { en: 'Check-in problem', ar: 'مشكلة في استلام الغرفة (Check-in)' },
        { en: 'Room problem', ar: 'مشكلة في نظافة أو تكييف الغرفة' },
        { en: 'I need hotel information', ar: 'محتاج معلومات عن الفندق' },
        { en: 'I need to contact the hotel', ar: 'عايز أتواصل مع الاستقبال' },
        { en: 'Something else', ar: 'حاجة تانية' },
      ],
    },
    activity: {
      title: "What's happening with your activity?",
      titleAr: 'إيه اللي حصل في النشاط أو التجربة؟',
      options: [
        { en: 'Activity changed', ar: 'النشاط اتغير أو اتأجل' },
        { en: 'Activity is delayed', ar: 'بداية النشاط اتأخرت' },
        { en: "I can't find the meeting point", ar: 'مش لاقي نقطة التجمع' },
        { en: 'I want to change the activity', ar: 'عايز أبدل النشاط بنشاط تاني' },
        { en: 'Something else', ar: 'حاجة تانية' },
      ],
    },
    other: {
      title: 'Tell us what happened',
      titleAr: 'احكيلنا إيه اللي حصل بالضبط',
      options: [],
    },
  };

  // Category selection handler
  const handleSelectCategory = (cat: HelpCategory) => {
    setSelectedCategory(cat);
    if (cat === 'booking') {
      setCurrentStep('select_booking');
    } else if (cat === 'other') {
      setCurrentStep('custom_input');
    } else {
      if (cat === 'transport') {
        setIsUrgent(true);
      } else {
        setIsUrgent(false);
      }
      setCurrentStep('specific_issue');
    }
  };

  // Booking selection handler
  const handleSelectBooking = (bookingName: string) => {
    setSelectedBooking(bookingName);
    setCurrentStep('specific_issue');
  };

  // Specific issue choice handler
  const handleSelectIssue = (issue: string) => {
    setSelectedIssue(issue);
    if (issue === 'Something else' || issue === 'حاجة تانية') {
      setCurrentStep('custom_input');
      return;
    }

    if (
      issue === 'My driver is late' || 
      issue === "I can't find the pickup point" || 
      issue === "I can't find the meeting point" ||
      issue.includes('السائق') ||
      issue.includes('نقطة')
    ) {
      setIsUrgent(true);
    }

    runDiagnosis(issue);
  };

  // Custom text submit
  const handleSubmitCustomText = () => {
    const clean = sanitizeText(customText);
    if (!clean) {
      showToast(t('help.pleaseDescribeTheIssue'));
      return;
    }
    setSelectedIssue(clean);
    runDiagnosis(clean);
  };

  // Simulate smart diagnosis
  const runDiagnosis = (issueText: string) => {
    setCurrentStep('diagnosis');

    setTimeout(() => {
      if (
        issueText === "It's pending" ||
        issueText === 'My driver is late' ||
        issueText === 'Where is my driver?' ||
        issueText === 'Check-in problem' ||
        issueText === 'Activity changed' ||
        issueText.toLowerCase().includes('change') ||
        issueText.includes('معلق') ||
        issueText.includes('اتأخر') ||
        issueText.includes('اتغير')
      ) {
        setCurrentStep('self_service_result');
      } else {
        setCurrentStep('escalate_expert');
      }
    }, 1200);
  };

  /**
   * Sends the message to support, for real.
   *
   * It used to append the traveler's line locally and then, after a 1.2s
   * setTimeout, append a canned acknowledgement — with no request of any kind.
   * POST /api/support/messages stores it, and the reply below reports what
   * actually happened, including when it failed.
   */
  const handleSendMessage = async () => {
    const clean = sanitizeText(newChatInput);
    if (!clean || isSendingSupport) return;

    const stamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'ahmed',
      senderName: travelerName || 'You',
      senderNameAr: travelerName || 'أنت',
      text: clean,
      textAr: clean,
      time: stamp(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    setNewChatInput('');
    setIsSendingSupport(true);

    try {
      const { message } = await api.sendSupportMessage({
        message: clean,
        travelerName: travelerName || undefined,
        travelerPhone: profile.phone || undefined,
        travelerEmail: profile.email || undefined,
        tripId: activeTrip?.id,
        category: selectedCategory || undefined,
        bookingRef: selectedBooking || undefined,
        urgent: isUrgent
      });

      setChatMessages(prev => [...prev, {
        id: `msg-${message.id}`,
        sender: 'expert',
        senderName: 'Dahab Support',
        senderNameAr: 'دعم دهب',
        // The reference is the traveler's evidence that the message exists.
        text: `Received — reference ${message.id}. Operations can see this now. Call the number above if it cannot wait.`,
        textAr: `وصلت — رقم المرجع ${message.id}. فريق العمليات شايفها دلوقتي. لو مش مستني، اتصل بالرقم فوق.`,
        time: stamp(),
      }]);
    } catch (err: unknown) {
      // A failure is said plainly rather than hidden behind an acknowledgement.
      const detail = err instanceof Error ? err.message : '';
      setChatMessages(prev => [...prev, {
        id: `msg-err-${Date.now()}`,
        sender: 'expert',
        senderName: 'Dahab Support',
        senderNameAr: 'دعم دهب',
        text: `Your message was not sent${detail ? `: ${detail}` : ''}. Please call the number above.`,
        textAr: `رسالتك مبعتتش${detail ? `: ${detail}` : ''}. من فضلك اتصل بالرقم فوق.`,
        time: stamp(),
      }]);
    } finally {
      setIsSendingSupport(false);
    }
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
      showToast(
        sessionUser
          ? `Signed in as ${sessionUser.name || sessionUser.email}`
          : t('help.notSignedIn')
      );
    }
  };

  return (
    <div 
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col pb-28 md:pb-16 selection:bg-[var(--accent-secondary)]/20"
    >
      {/* Traveler Top Navigation */}
      <TravelerNav
        activeTab={activeNavTab}
        onNavigate={handleNavigate}
        onOpenHelp={() => setCurrentStep('categories')}
      />

      {/* Main Container */}
      <main className="mx-auto w-full max-w-7xl flex-grow px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        
        {/* Top Breadcrumb */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="back-to-companion-btn"
              onClick={onBackToCompanion || onBackToMyTrip}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-secondary)] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              <span>{t('help.backToDailyCompanion')}</span>
            </button>
            <span className="text-[var(--text-muted)]">•</span>
            <button
              type="button"
              onClick={onBackToMyTrip}
              className="inline-flex min-h-11 items-center rounded-full px-2 text-xs font-bold text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              {t('help.fullItinerary')}
            </button>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] font-bold">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse"></span>
            <span>{t('help.dahabLiveSupport247')}</span>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
          
          {/* Main Area (7/12) */}
          <div className="space-y-6 lg:col-span-8">

            {/* 1. Header Banner */}
            <header className="relative overflow-hidden rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.14)] sm:p-8 lg:p-10">
                          <div className="pointer-events-none absolute -end-16 -top-20 h-52 w-52 rounded-full bg-[var(--accent-primary)]/10 blur-3xl" aria-hidden="true" />
                          <div className="relative max-w-2xl space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-primary)]">
                  {t('help.sinaiExpertConcierge')}
                </p>
                <span className="text-xs text-[var(--text-secondary)]/50 font-mono">{t('help.realtimeResponse')}</span>
              </div>
              <h1 className="font-display text-4xl font-black tracking-tight text-[var(--text-primary)] text-balance sm:text-5xl">
                {travelerName ? t('help.needHelpNamed', { travelerName }) : t('help.needHelpGeneric')}
              </h1>
              <p className="max-w-xl text-base font-normal leading-7 text-[var(--text-secondary)]">
                  {t('help.tellUsWhatHappened')}
                </p>
              </div>
            </header>

            {/* Urgency Alert */}
            {isUrgent && (
              <div 
                id="urgency-alert-banner"
                className="flex items-start gap-3.5 rounded-2xl border border-amber-500/50 bg-amber-950/70 p-4 text-amber-200 shadow-sm animate-in fade-in duration-200 sm:p-5"
              >
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center flex-shrink-0 shadow-xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <h2 className="font-bold text-amber-200 text-sm">
                    {t('help.timesensitiveIssue')}
                  </h2>
                  <p className="text-amber-200/80 leading-relaxed">
                    {t('help.ourLocalCoordinatorIs')}
                  </p>
                </div>
              </div>
            )}

            {/* STEP 1: CATEGORIES SELECTOR */}
            {currentStep === 'categories' && (
              <section className="space-y-5 rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-sm sm:p-6">
                <h2 className="text-xl chart-heading font-black tracking-tight text-[var(--text-primary)] sm:text-2xl">
                  {t('help.whatIsYourIssue')}
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'booking' as HelpCategory, Icon: CalendarDays, title: 'A booking', titleAr: 'حجز نشاط' },
                    { id: 'transport' as HelpCategory, Icon: Car, title: 'Transport / Driver', titleAr: 'مواصلات وسائق' },
                    { id: 'food' as HelpCategory, Icon: Utensils, title: 'Food & Dining', titleAr: 'أكل ومطاعم' },
                    { id: 'hotel' as HelpCategory, Icon: BedDouble, title: 'Hotel / Stay', titleAr: 'فندق وإقامة' },
                    { id: 'activity' as HelpCategory, Icon: Sailboat, title: 'Activity on trip', titleAr: 'تجارب وأنشطة' },
                    { id: 'other' as HelpCategory, Icon: MessageCircle, title: 'Something else', titleAr: 'حاجة تانية' },
                  ].map((cat) => {
                    const CatIcon = cat.Icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectCategory(cat.id)}
                        className="min-h-[112px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-4 text-start shadow-sm transition-[background-color,border-color,color,box-shadow,transform,opacity] hover:border-[var(--accent-secondary)]/50 hover:bg-[var(--surface-card)] hover:shadow-md active:scale-[0.99] rtl:text-end cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      >
                        <span className="w-9 h-9 rounded-xl bg-[var(--surface-container)] text-[var(--accent-primary)] flex items-center justify-center">
                          <CatIcon className="w-4 h-4" aria-hidden="true" />
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-secondary)] block">
                          {language === 'ar' ? cat.titleAr : cat.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* STEP 2: SELECT BOOKING */}
            {currentStep === 'select_booking' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg chart-heading font-bold text-[var(--text-primary)]">
                    {t('help.whichBookingIsThis')}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setCurrentStep('categories')}
                    className="text-xs text-[var(--accent-secondary)] hover:underline cursor-pointer"
                  >
                    {t('help.changeCategory')}
                  </button>
                </div>

                <div className="space-y-2.5">
                  {activeBookings.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-5 text-center space-y-3">
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed m-0">
                        {t('help.noBookingsOnTrip')}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleSelectBooking('')}
                        className="px-4 py-2 rounded-full text-xs font-bold cursor-pointer border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--surface-container)] transition-[background-color] cursor-pointer"
                      >
                        {t('help.continueWithoutBooking')}
                      </button>
                    </div>
                  ) : (
                    activeBookings.map((b) => {
                      const ItemIcon = b.Icon;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleSelectBooking(b.name)}
                          className="w-full p-4 rounded-2xl bg-[var(--surface-card)] hover:bg-[var(--surface-container)] border border-[var(--border-subtle)] hover:border-[var(--accent-secondary)]/40 transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-between text-start rtl:text-end cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-9 h-9 rounded-xl bg-[var(--surface-container)] text-[var(--accent-primary)] flex items-center justify-center flex-shrink-0">
                              <ItemIcon className="w-4 h-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <h3 className="font-bold text-sm text-[var(--text-primary)] truncate">{b.name}</h3>
                              <span className="text-xs text-[var(--text-secondary)]/60">{b.time}</span>
                            </div>
                          </div>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                            b.status.includes('Pending')
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}>
                            {b.status}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: SPECIFIC ISSUE OPTIONS */}
            {currentStep === 'specific_issue' && selectedCategory && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg chart-heading font-bold text-[var(--text-primary)]">
                    {language === 'ar' ? categoryIssues[selectedCategory].titleAr : categoryIssues[selectedCategory].title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setCurrentStep('categories')}
                    className="text-xs text-[var(--accent-secondary)] hover:underline cursor-pointer"
                  >
                    {t('help.back')}
                  </button>
                </div>

                <div className="space-y-2.5">
                  {categoryIssues[selectedCategory].options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectIssue(opt.en)}
                      className="w-full p-4 rounded-2xl bg-[var(--surface-card)] hover:bg-[var(--surface-container)] border border-[var(--border-subtle)] hover:border-[var(--accent-secondary)]/40 transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-between text-start rtl:text-end cursor-pointer"
                    >
                      <span className="font-bold text-sm text-[var(--text-primary)]">{language === 'ar' ? opt.ar : opt.en}</span>
                      <ChevronRight className="w-4 h-4 text-[var(--accent-secondary)] rtl:rotate-180" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4: CUSTOM TEXT INPUT */}
            {currentStep === 'custom_input' && (
              <div className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xl space-y-4">
                <h2 className="text-lg chart-heading font-bold text-[var(--text-primary)]">
                  {t('help.describeTheIssueIn')}
                </h2>
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder={t('help.egDriverIsNot')}
                  rows={4}
                  className="w-full p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/40 focus:border-[var(--accent-secondary)] focus:outline-none"
                />

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setHasPhotoAttached(!hasPhotoAttached)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                      hasPhotoAttached
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-[var(--surface-container)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--btn-util-bg)]'
                    }`}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>{hasPhotoAttached ? (t('help.photoAttached')) : (t('help.attachPhotoscreenshot'))}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmitCustomText}
                    className="px-5 py-2 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--accent-secondary-ink)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-xs cursor-pointer"
                  >
                    {t('help.checkSolutions')}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: DIAGNOSIS ANIMATION */}
            {currentStep === 'diagnosis' && (
              <div className="bg-[var(--surface-card)] rounded-3xl p-8 border border-[var(--border-subtle)] shadow-xl text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-[var(--surface-container)] border border-[var(--accent-secondary)]/40 text-[var(--accent-secondary)] flex items-center justify-center mx-auto animate-spin">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="chart-heading font-bold text-lg text-[var(--text-primary)]">
                    {t('help.diagnosingAndVerifyingLive')}
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]/70">
                    {t('help.checkingProvidersAndTelemetry')}
                  </p>
                </div>
              </div>
            )}

            {/* STEP 6: SELF SERVICE RESULT (Automated resolution) */}
            {currentStep === 'self_service_result' && (
              <div className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-emerald-500/40 shadow-xl space-y-5">
                <div className="flex items-center gap-3">
                  {/*
                    This panel used to open with a green tick, "Instant Solution
                    Available", and the claim "We reviewed your booking status
                    and found the right solution" — followed by a specific
                    diagnosis: the boat trip was pending "due to today's winds"
                    and alternatives had been "prepared". None of it was true
                    for anyone. It rendered identically whatever the traveler
                    picked, for whatever booking, in whatever weather, with no
                    review of anything having taken place.

                    What is real is the two routes out: the Change & Recovery
                    flow, and support. The panel offers those.
                  */}
                  <div className="w-10 h-10 rounded-2xl bg-[var(--surface-container)] text-[var(--accent-secondary)] border border-[var(--border-subtle)] flex items-center justify-center">
                    <ArrowRight className="w-5 h-5 rtl:rotate-180" aria-hidden="true" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                      {t('help.whatYouCanDo')}
                    </span>
                    <h2 className="chart-heading font-bold text-lg text-[var(--text-primary)]">
                      {t('help.twoWaysToSort')}
                    </h2>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-2 text-xs text-[var(--text-secondary)]">
                  <p className="font-bold text-[var(--text-primary)]">
                    {t('help.youCanLookAt')}
                  </p>
                  <p className="text-[var(--text-secondary)]/70">
                    {t('help.ifItCannotWait')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateToChangeRecovery) onNavigateToChangeRecovery();
                    }}
                    className="px-5 py-2.5 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold text-xs shadow-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{t('help.openChangeRecovery')}</span>
                    <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep('expert_chat')}
                    className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-secondary)] hover:underline cursor-pointer"
                  >
                    {t('help.sendTheDetailsTo')}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 7: ESCALATE TO EXPERT */}
            {currentStep === 'escalate_expert' && (
              <div className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--accent-secondary)]/40 shadow-xl space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/40 flex items-center justify-center">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black text-[var(--accent-secondary)] block">
                      {t('help.escalatingToSinaiExpert')}
                    </span>
                    <h2 className="chart-heading font-bold text-lg text-[var(--text-primary)]">
                      {/* Was "Kareem from Dahab Support is taking over" —
                          stated as an accomplished fact while nothing had been
                          sent anywhere. It now describes what the traveler can
                          do, which is what actually exists. */}
                      {t('help.thisNeedsTheProvider')}
                    </h2>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                  {t('help.thisNeedsDirectCoordination')}
                </p>

                <button
                  type="button"
                  onClick={() => setCurrentStep('expert_chat')}
                  className="w-full py-3 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold text-xs shadow-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{t('help.openSupportChat')}</span>
                </button>
              </div>
            )}

            {/* STEP 8: LIVE EXPERT CHAT */}
            {currentStep === 'expert_chat' && (
              <div className="bg-[var(--surface-card)] rounded-3xl border border-[var(--border-subtle)] shadow-xl overflow-hidden flex flex-col h-[480px]">
                {/* Chat Header */}
                <div className="p-4 bg-[var(--surface-container)] border-b border-[var(--border-subtle)] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold flex items-center justify-center text-xs">
                      K
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-[var(--text-primary)]">{t('help.dahabSupport')}</h3>
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>{t('help.onlineNow')}</span>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentStep('categories')}
                    className="text-xs text-[var(--text-secondary)]/60 hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {t('help.close')}
                  </button>
                </div>

                {/* Messages List */}
                <div className="p-4 overflow-y-auto space-y-3 flex-grow text-xs">
                  {chatMessages.map((msg) => {
                    const isMe = msg.sender === 'ahmed';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`p-3.5 rounded-2xl max-w-[80%] leading-relaxed ${
                            isMe
                              ? 'bg-[var(--accent-secondary)] text-[var(--surface-card)] font-semibold rounded-tr-none rtl:rounded-tr-2xl rtl:rounded-tl-none'
                              : 'bg-[var(--surface-container)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-tl-none rtl:rounded-tl-2xl rtl:rounded-tr-none'
                          }`}
                        >
                          {language === 'ar' ? msg.textAr : msg.text}
                        </div>
                        <span className="text-[11px] text-[var(--text-secondary)]/40 mt-1 px-1">
                          {msg.time}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Input Bar */}
                <div className="p-3 bg-[var(--surface-container)] border-t border-[var(--border-subtle)] flex items-center gap-2">
                  <input
                    type="text"
                    value={newChatInput}
                    onChange={(e) => setNewChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSendMessage(); }}
                    aria-label={t('help.typeYourMessageTo')}
                    placeholder={t('help.typeYourMessageTo-2')}
                    className="flex-1 p-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/40 focus:border-[var(--accent-secondary)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={isSendingSupport || !newChatInput.trim()}
                    aria-label={t('help.sendMessageToSupport')}
                    className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--surface-card)] font-bold cursor-pointer transition-[background-color,border-color,color,box-shadow,transform,opacity]"
                  >
                    <Send className="w-4 h-4 rtl:rotate-180" />
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Secondary Context Sidebar (5/12) */}
          <div className="lg:col-span-5 space-y-6">

            {/* 1. Direct Hotline */}
            <div className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                <PhoneCall className="w-5 h-5 text-[var(--accent-secondary)]" />
                <h2 className="chart-heading font-bold text-base text-[var(--text-primary)]">
                  {t('help.emergencyDriverHotline')}
                </h2>
              </div>

              <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed">
                {t('help.ifYouNeedImmediate')}
              </p>

              {/* Emergency hotlines from backend */}
              <div className="space-y-2">
                {emergencyState === 'loading' && (
                  <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-dashed border-[var(--border-subtle)] text-center">
                    <RefreshCw className="w-4 h-4 text-[var(--text-secondary)] mx-auto animate-spin mb-2" />
                    <p className="text-xs text-[var(--text-secondary)]/70">{t('help.loadingEmergency')}</p>
                  </div>
                )}
                {emergencyState === 'error' && (
                  <div className="p-4 rounded-2xl bg-red-950/30 border border-red-500/40 text-center space-y-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 mx-auto" />
                    <p className="text-xs text-red-300/80">{emergencyError || t('help.unableToLoadEmergency')}</p>
                    <p className="text-[11px] text-red-300/60">{t('help.ifYouNeedImmediate')}</p>
                  </div>
                )}
                {emergencyState === 'loaded' && emergencyHotlines.length === 0 && (
                  <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-dashed border-[var(--border-subtle)] text-center">
                    <p className="text-xs text-[var(--text-secondary)]/70">{t('help.noEmergencyHotlines')}</p>
                  </div>
                )}
                {emergencyState === 'loaded' && emergencyHotlines.map((hotline, idx) => (
                  <a
                    key={idx}
                    href={`tel:${hotline.number.replace(/[^+\d]/g, '')}`}
                    className="p-3 rounded-2xl bg-[var(--surface-container)] hover:bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center justify-between transition-colors block cursor-pointer group"
                  >
                    <div>
                      <span className="text-[11px] text-[var(--text-secondary)]/60 font-bold block">{hotline.service}</span>
                      <span className="font-mono text-sm font-bold text-[var(--accent-secondary)] group-hover:text-amber-300 transition-colors">{hotline.number}</span>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] flex items-center justify-center">
                      <PhoneForwarded className="w-4 h-4" />
                    </div>
                  </a>
                ))}
              </div>

              {/* Email & GPS Actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a 
                  href="mailto:ops@dahabtravelos.com?subject=Urgent%20Dahab%20Assistance%20Request%20-%20Ahmed"
                  className="p-2.5 rounded-xl bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                  <span>{t('help.emailOps')}</span>
                </a>
                <a 
                  href="https://maps.google.com/?q=28.5097,34.5136"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <LocateFixed className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t('help.dahabGPS')}</span>
                </a>
              </div>
            </div>

            {/* 2. Peace of Mind Guarantee */}
            <div className="bg-[var(--surface-container)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xl space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="chart-heading font-bold text-base text-[var(--text-primary)]">
                  {t('help.travelerProtectionGuarantee')}
                </h3>
              </div>

              <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed">
                {t('help.allTransportDelaysAnd')}
              </p>
            </div>

          </div>

        </div>

      </main>

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

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useConciergeT } from './useConciergeT';
import { api, DayGiStreamUnavailable } from '../../services/api';
import { 
  DayGiResponse, 
  DayGiActionType, 
  DayGiActionRisk,
  DayGiTaskPlan,
  DayGiWhatChangedCard,
  DayGiMultiOptionResult,
  DayGiMultiActionConfirmation,
  DayGiTripHealth,
  DayGiTripHealthIssue,
  DayGiStructuredMemory,
  DayGiProactiveSuggestion,
  DayGiConstraintModel,
  DayGiOrchestratedTask,
  DayGiOrchestratedStep,
  DayGiTaskState,
  DayGiStepState,
  DayGiRecoveryOption,
  DayGiCanvasItem,
  DayGiChatSummary,
  DayGiStoredChatMessage
} from '../../types';
import { 
  Sparkles, 
  Send, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  ArrowLeft,
  Home, 
  Utensils, 
  Compass, 
  Calendar, 
  ThumbsUp, 
  ThumbsDown, 
  HelpCircle, 
  ShieldCheck, 
  Flame, 
  ChevronRight,
  RefreshCw,
  Waves,
  ShoppingBag,
  AlertTriangle,
  DollarSign,
  TrendingDown,
  Activity,
  Layers,
  ArrowUpRight,
  Check,
  Zap,
  SlidersHorizontal,
  FileText,
  HeartPulse,
  Brain,
  Bell,
  X,
  Sliders,
  ChevronDown,
  Info,
  GitBranch,
  Cpu,
  RotateCcw,
  CheckSquare,
  History,
  Lock,
  Database,
  PanelRight,
  Share2,
  Square,
  Trash2
} from 'lucide-react';
import { BookNowCommerceModal } from '../commerce/BookNowCommerceModal';
import { ChatMessage } from './types';
import { DayGiCanvasPanel } from './DayGiCanvasPanel';
import { DayGiChatHistoryModal } from './DayGiChatHistoryModal';
import { DayGiShareModal } from './DayGiShareModal';
import { DayGiComposerContext } from './DayGiComposerContext';
import { DayGiOptionMenu, mentionOption } from './DayGiComposerMenus';
import { DayGiStreamedText } from './DayGiStreamedText';

/*
 * Anonymous chat persistence (BUG-5). The conversation is the traveler's own
 * work — questions they typed and answers they were given — so it survives a
 * reload in localStorage, session-scoped and capped. `daygi:` prefix per the
 * DayGI storage convention; the greeting is regenerated fresh each mount and
 * never stored.
 */
const DAYGI_CHAT_HISTORY_KEY = 'daygi:chatHistory';
const DAYGI_CHAT_HISTORY_MAX = 50;

export const DayGiConciergeView: React.FC = () => {
  const {
    profile,
    tripDays, 
    tripBrief, 
    bookings, 
    activeDayGiPrompt, 
    setActiveDayGiPrompt, 
    shiftActivityBetweenDays,
    navigateTo,
    showToast,
    user,
    isSignedIn,
    activeTrip,
    goBack,
    canGoBack,
    currentRoute
  } = useTrip();

  /**
   * The traveler's own trip.
   *
   * Every DayGI call on this page — the proactive suggestions, the trip-health
   * read, the task list and all seventeen funnel events — was scoped to the
   * literal 'DHB-TRIP-894', the seeded demo trip. So the assistant answered
   * about somebody else's itinerary, and the product telemetry attributed every
   * traveler's session to one trip.
   */
  const activeTripId = activeTrip?.id || '';

  /**
   * This view keeps its own language state so the traveler can flip the
   * concierge's language without changing the whole site. It was hardcoded to
   * 'ar' and never looked at the global setting, so switching the site to
   * English and opening the AI Director still produced a fully Arabic screen —
   * the user's explicit language choice was silently ignored on this page.
   *
   * Seed from the global language and follow it when it changes; the in-page
   * toggle still wins after that.
   */
  const { language: siteLanguage } = useLanguage();
  const [lang, setLang] = useState<'ar' | 'en'>(siteLanguage);
  useEffect(() => { setLang(siteLanguage); }, [siteLanguage]);

  /**
   * Concierge-local translator: same resolution the global t() performs, but
   * bound to THIS page's language toggle instead of the site language. Every
   * string on this screen — header labels, section titles, feedback row,
   * toasts — must follow the concierge toggle; a site-bound t() is what
   * produced Arabic titles inside English response blocks.
   */
  const tc = useConciergeT(lang);

  const [currentLocation, setCurrentLocation] = useState<string>('Lighthouse');
  const [availableMinutes, setAvailableMinutes] = useState<number>(120);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  
  // Trip Health & Memory State
  const [tripHealth, setTripHealth] = useState<DayGiTripHealth | null>(null);
  const [proactiveSuggestions, setProactiveSuggestions] = useState<DayGiProactiveSuggestion[]>([]);
  const [userMemory, setUserMemory] = useState<DayGiStructuredMemory | null>(null);
  
  // DayGI 4.0 Orchestrator State
  const [orchestratedTasks, setOrchestratedTasks] = useState<DayGiOrchestratedTask[]>([]);
  const [tasksModalOpen, setTasksModalOpen] = useState<boolean>(false);
  const [executingStepId, setExecutingStepId] = useState<string | null>(null);
  const [recoveryInProgress, setRecoveryInProgress] = useState<string | null>(null);
  
  // Modals / Drawers
  const [healthModalOpen, setHealthModalOpen] = useState<boolean>(false);
  const [memoryModalOpen, setMemoryModalOpen] = useState<boolean>(false);
  const [proactiveBannerDismissed, setProactiveBannerDismissed] = useState<boolean>(false);
  const [feedbackReasonOpenId, setFeedbackReasonOpenId] = useState<string | null>(null);

  /*
    Plan canvas — the structured document beside the conversation.

    The canvas shows the latest plan the server built (multi-step options,
    briefing timeline, dining recs, recovery alternatives). It opens
    automatically when a response carries one, and pin/remove are view-only
    overrides: the traveler curates the reading of the plan without mutating
    any server state. Overrides reset when a new document arrives.
  */
  const [canvasOpen, setCanvasOpen] = useState<boolean>(false);
  const [canvasOverrides, setCanvasOverrides] = useState<Record<string, 'pinned' | 'removed'>>({});

  /*
    Saved conversations ("All chats").

    activeChatId is the id of the chat the current transcript belongs to; the
    server returns it on every query response, so the next turn keeps
    appending to the same conversation. It starts null: the first message
    creates a chat server-side.
  */
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatsModalOpen, setChatsModalOpen] = useState<boolean>(false);
  const [chats, setChats] = useState<DayGiChatSummary[]>([]);
  const [chatsLoading, setChatsLoading] = useState<boolean>(false);
  /*
    The in-flight request's abort controller. The send button becomes Stop
    while isLoading; pressing it aborts the stream (or the plain query) and
    the catch below commits whatever text had already arrived.
  */
  const streamAbortRef = useRef<AbortController | null>(null);
  const streamingTextRef = useRef<string | null>(null);
  /**
   * The wait phase must be perceivable.
   *
   * A deterministic answer can arrive inside one frame: `setIsLoading(true)`
   * and the first `text` chunk land in the same paint, so the matching-status
   * bubble never renders and the reply appears with no sign the request was
   * received. Holding the first chunk for a beat makes the phase real instead
   * of theoretical — and keeps the streaming text from flashing for 40ms.
   */
  const WAIT_PHASE_MIN_MS = 420;
  const waitStartedAtRef = useRef<number>(0);
  const firstChunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFirstChunkRef = useRef<string | null>(null);
  /*
    "Asked while viewing X" — the page tag under the traveler's bubble.
    Resolved once at send time from the current route into a display label;
    the raw route never leaves the client.
  */
  const viewingLabel = useMemo(() => {
    switch (currentRoute) {
      case '/': return tc('daygi.viewingHome');
      case '/my-trip':
      case '/my-trip/day':
      case '/my-trip/activity': return tc('daygi.viewingMyTrip');
      case '/daygi':
      case '/ai-director': return tc('daygi.viewingDaygi');
      case '/trip-builder':
      case '/trip-preview':
      case '/plan':
      case '/plan-for-me': return tc('daygi.viewingPlanner');
      default: return tc('daygi.viewingThisPage');
    }
  }, [currentRoute, tc, lang]);
  /*
    The message currently being "streamed" in. The deterministic answer
    arrives whole; the reveal only paces its reading (and is skipped entirely
    for reduced-motion users and resumed chats).
  */
  const [streamedMessageId, setStreamedMessageId] = useState<string | null>(null);
  /*
    Composer context chips: travel dates + traveler count. Persist across
    messages so the server can personalize (price × travelers, date-aware
    recommendations).
  */
  const [travelDates, setTravelDates] = useState<{ start: string; end: string } | null>(null);
  const [travelersCount, setTravelersCount] = useState<number>(2);
  /*
    The paced-out reply text while the SSE stream is active. The answer is
    already complete server-side; this state only renders the chunks as they
    arrive, replacing the loading bubble.
  */
  const [streamingText, setStreamingText] = useState<string | null>(null);

  // Closed Beta Session ID
  const sessionIdRef = useRef<string>(`SESS-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);

  // Initial Funnel Tracking (DAYGI_OPENED).
  // Funnel events are attributed to the session user server-side, so there is
  // nothing to record — and nothing but a 401 to gain — before sign-in.
  useEffect(() => {
    // Was gated on `user`, the Firebase user — permanently null on a deployment
    // without Firebase Admin credentials, so this never fired for anyone.
    if (!isSignedIn) return;
    api.trackDayGiFunnel({
      sessionId: sessionIdRef.current,
      tripId: activeTripId,
      step: 'DAYGI_OPENED',
      language: lang
    });
  }, [isSignedIn, lang]);

  // Commercial modal integration
  const [bookModalOpen, setBookModalOpen] = useState<boolean>(false);
  const [selectedSkuId, setSelectedSkuId] = useState<string>('SKU-DIV-001');

  /*
   * A greeting, and nothing else.
   *
   * This message used to ship a fabricated `responsePayload` presented as
   * measured fact to every visitor, signed in or not: a hardcoded
   * "Health score 94/100", a rationale claiming to audit "live CDWS marine
   * telemetry, Cloud SQL ledger, and supplier SLAs" (none of which this
   * system reads), a `sourceConfidence` of VERIFIED_FACT / 0.99 marked
   * "Live (Synchronized with Active Itinerary)", and a four-item daily
   * briefing — breakfast at Ralphs, Lighthouse snorkeling, lunch at Ali
   * Baba, sunset at Eel Garden — with times, shown as *today's plan* to
   * people who have no trip at all.
   *
   * An assistant's first message sets what its later ones are worth.
   *
   * Extracted from the state initializer so "New chat" can rebuild it.
   */
  const makeGreetingMessage = (): ChatMessage => ({
    id: 'msg-welcome',
    sender: 'daygi',
    text: tc('dayGi.helloAskAnything', {
      name: profile.name ? tc('dayGi.helloName', { name: profile.name }) : '',
    }),
    timestamp: 'Just now'
  });

  // Messages list initialized with DayGI 3.0 operating greeting.
  // BUG-5: the conversation previously died on every reload — the traveler's
  // own messages were the thing most worth keeping on an anonymous visit.
  // History now persists to localStorage (key `daygi:chatHistory`, capped at
  // CHAT_HISTORY_MAX messages); "Clear conversation" removes it explicitly.
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const greeting = makeGreetingMessage();
    try {
      const raw = localStorage.getItem(DAYGI_CHAT_HISTORY_KEY);
      if (!raw) return [greeting];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [greeting];
      const restored = parsed
        .filter((m): m is ChatMessage =>
          !!m && typeof m === 'object' &&
          typeof (m as ChatMessage).id === 'string' &&
          typeof (m as ChatMessage).text === 'string' &&
          ((m as ChatMessage).sender === 'user' || (m as ChatMessage).sender === 'daygi'))
        .slice(-DAYGI_CHAT_HISTORY_MAX);
      return [greeting, ...restored];
    } catch {
      return [greeting];
    }
  });

  // Persist the conversation (minus the regenerated greeting) after every
  // change. On quota pressure, keep the newest half; if that still fails,
  // give up silently — losing history must never break the chat.
  useEffect(() => {
    const persistable = messages.filter(m => m.id !== 'msg-welcome').slice(-DAYGI_CHAT_HISTORY_MAX);
    try {
      localStorage.setItem(DAYGI_CHAT_HISTORY_KEY, JSON.stringify(persistable));
    } catch {
      try {
        localStorage.setItem(
          DAYGI_CHAT_HISTORY_KEY,
          JSON.stringify(persistable.slice(-Math.ceil(DAYGI_CHAT_HISTORY_MAX / 2)))
        );
      } catch {
        // Storage unavailable or full — the in-memory conversation still works.
      }
    }
  }, [messages]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);
  const lastMessageCount = useRef<number>(1);

  const canvasDoc = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const doc = messages[i].responsePayload?.canvas;
      if (doc) return doc;
    }
    return null;
  }, [messages]);
  const canvasDocId = canvasDoc?.id ?? null;
  const prevCanvasIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (canvasDocId && canvasDocId !== prevCanvasIdRef.current) {
      prevCanvasIdRef.current = canvasDocId;
      setCanvasOverrides({});
      setCanvasOpen(true);
    }
    if (!canvasDocId) {
      prevCanvasIdRef.current = null;
    }
  }, [canvasDocId]);

  const handleToggleCanvasPin = (itemId: string) => {
    setCanvasOverrides(prev => {
      const next = { ...prev };
      if (next[itemId] === 'pinned') {
        delete next[itemId];
      } else {
        next[itemId] = 'pinned';
      }
      return next;
    });
  };

  const handleRemoveCanvasItem = (itemId: string) => {
    setCanvasOverrides(prev => ({ ...prev, [itemId]: 'removed' }));
  };

  /*
    Stop = abort the in-flight request. The catch in handleSendMessage
    commits whatever text had already streamed; pressing Stop with nothing
    arrived yet simply ends the wait.
  */
  const handleStopGenerating = () => {
    streamAbortRef.current?.abort();
  };

  /*
    Share = a public snapshot link for the active chat, TripAdvisor-style.
    Minting can fail (or there may be no saved chat yet); then the old
    clipboard transcript is the fallback rather than a dead button.
  */
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCreating, setShareCreating] = useState<boolean>(false);

  const copyTranscriptFallback = async () => {
    const youLabel = tc('daygi.transcriptYou');
    const daygiLabel = tc('daygi.transcriptDaygi');
    const lines = messages.map(msg => {
      const who = msg.sender === 'user' ? youLabel : daygiLabel;
      return `${who}: ${msg.text}`;
    });
    try {
      await navigator.clipboard.writeText(lines.join('\n\n'));
      showToast(tc('daygi.transcriptCopied'));
    } catch (err) {
      console.debug('Share transcript handled:', err);
      showToast(tc('daygi.copyFailed'));
    }
  };

  const handleShareChat = async () => {
    if (!activeChatId) {
      await copyTranscriptFallback();
      return;
    }
    setShareModalOpen(true);
    setShareUrl(null);
    setShareCreating(true);
    try {
      const { shareId } = await api.shareDayGiChat(activeChatId);
      setShareUrl(`${window.location.origin}/shared/${shareId}`);
    } catch (err) {
      console.debug('Share link creation handled:', err);
      setShareModalOpen(false);
      await copyTranscriptFallback();
    } finally {
      setShareCreating(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (err) {
      console.debug('Share link copy handled:', err);
      showToast(tc('daygi.copyFailed'));
      throw err;
    }
  };

  const handleAskAboutCanvasItem = (item: DayGiCanvasItem, replace: boolean) => {
    const name = lang === 'ar' ? (item.nameAr || item.name) : item.name;
    setInputText(tc(replace ? 'daygi.canvasReplaceQuery' : 'daygi.canvasAskQuery', { name }));
    composerInputRef.current?.focus();
  };

  /*
    Regenerate = a genuine follow-up turn asking for fresh alternatives to
    whatever the traveler left unpinned in the latest plan. Pinned items are
    named so the answer can work around them; with nothing unpinned there is
    nothing to regenerate, so the button's owner (the panel) still renders
    but this stays a no-op... in practice the panel always has visible items,
    and an all-pinned plan regenerates around an empty set, i.e. asks for
    more options like the current ones.
  */
  const handleRegenerateCanvas = () => {
    if (!canvasDoc) return;
    const unpinned = canvasDoc.days
      .flatMap(day => day.items)
      .filter(item => canvasOverrides[item.id] !== 'removed' && canvasOverrides[item.id] !== 'pinned' && item.kind !== 'NOTE');
    const names = unpinned
      .map(item => (lang === 'ar' ? (item.nameAr || item.name) : item.name))
      .join(lang === 'ar' ? '، ' : ', ');
    handleSendMessage(tc('daygi.canvasRegenerateQuery', { names: names || (lang === 'ar' ? 'الخيارات' : 'the options') }));
  };

  const handleExecuteCanvasItem = (item: DayGiCanvasItem) => {
    // Canvas booking opens the same checkout handoff the booking card uses:
    // the traveler reviews and confirms inside the modal. It never fires a
    // headless server-side hold from a card button.
    if (!item.skuId) return;
    handleOpenBookingHandoff(item.skuId);
  };

  const formatChatTimestamp = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleOpenChats = async () => {
    setChatsModalOpen(true);
    setChatsLoading(true);
    try {
      const list = await api.getDayGiChats();
      setChats(Array.isArray(list) ? list : []);
    } catch (err) {
      console.debug('Chat history load handled:', err);
      setChats([]);
    } finally {
      setChatsLoading(false);
    }
  };

  const handleResumeChat = async (chatId: string) => {
    try {
      const record = await api.getDayGiChat(chatId);
      if (!record || !Array.isArray(record.messages)) throw new Error('Malformed chat record');
      setActiveChatId(chatId);
      setMessages(
        record.messages.map((m: DayGiStoredChatMessage) => ({
          id: m.id,
          sender: m.sender,
          text: m.text,
          timestamp: formatChatTimestamp(m.timestamp),
          responsePayload: m.responsePayload
        }))
      );
      setChatsModalOpen(false);
    } catch (err) {
      console.debug('Chat resume handled:', err);
      showToast(tc('daygi.chatResumeFailed'));
    }
  };

  const handleNewChat = () => {
    setActiveChatId(null);
    // Explicit clear: wipe the persisted transcript too, so a reload cannot
    // resurrect the conversation the traveler just erased.
    try {
      localStorage.removeItem(DAYGI_CHAT_HISTORY_KEY);
    } catch {
      // Storage unavailable — the in-memory reset below still applies.
    }
    setMessages([makeGreetingMessage()]);
    setChatsModalOpen(false);
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      await api.deleteDayGiChat(chatId);
      setChats(prev => prev.filter(c => c.chatId !== chatId));
      if (activeChatId === chatId) setActiveChatId(null);
    } catch (err) {
      console.debug('Chat delete handled:', err);
      showToast(tc('daygi.chatDeleteFailed'));
    }
  };

  /**
   * Scrolls the transcript, not the document.
   *
   * `scrollIntoView` walked up to the window and scrolled the whole page, so
   * on mount the opening message dragged the page down far enough to bury the
   * concierge's own command bar underneath the fixed global navbar — the
   * traveler landed on the screen with the header, trip health and context
   * controls already off-screen. The transcript is its own scroll container
   * now, and the first paint is left where it belongs: at the top.
   */
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  useEffect(() => {
    const grew = messages.length > lastMessageCount.current;
    lastMessageCount.current = messages.length;
    // Follow the conversation only once it has actually moved. Anchoring on a
    // "first run" flag is not enough: StrictMode replays mount effects, which
    // put the opening screen back at the bottom of the transcript.
    if (grew || (isLoading && messages.length > 1)) {
      scrollToBottom();
    }
  }, [messages, isLoading]);

  // Load Initial Proactive State, Trip Health & Orchestrated Tasks
  useEffect(() => {
    // These endpoints are per-user and now require a session. Firing them while
    // signed out produced a burst of 401s on every mount and could only ever
    // return nothing; clear any state left over from a previous user instead.
    // The whole panel — suggestions, trip health, memory, tasks — was gated on
    // the Firebase user and therefore never loaded once. A traveler signed in
    // with a password opened DayGI to an empty assistant.
    if (!isSignedIn) {
      setProactiveSuggestions([]);
      setTripHealth(null);
      setUserMemory(null);
      setOrchestratedTasks([]);
      return;
    }

    // Trip-scoped reads stay home when there is no trip: firing them with an
    // empty tripId produced a burst of 400s on every mount for travelers who
    // have not planned anything yet. Memory is user-scoped and always loads.
    const fetchProactiveData = async () => {
      try {
        const [proactiveRes, healthRes, memoryRes, tasksRes] = await Promise.all([
          activeTripId ? api.getDayGiProactive(activeTripId).catch(() => null) : Promise.resolve(null),
          activeTripId ? api.getDayGiTripHealth(activeTripId).catch(() => null) : Promise.resolve(null),
          api.getDayGiMemory().catch(() => null),
          activeTripId ? api.getDayGiTasks(activeTripId).catch(() => []) : Promise.resolve([])
        ]);
        if (proactiveRes?.suggestions) {
          setProactiveSuggestions(proactiveRes.suggestions);
        }
        if (healthRes) {
          setTripHealth(healthRes);
        }
        if (memoryRes) {
          setUserMemory(memoryRes);
        }
        if (Array.isArray(tasksRes)) {
          setOrchestratedTasks(tasksRes);
        }
      } catch (err) {
        console.debug('Proactive data initialization handled:', err);
      }
    };
    fetchProactiveData();
    // Reload when the signed-in user changes. This previously depended on
    // `profile.id`, which does not exist on TravelerProfile and was therefore
    // permanently undefined — so the effect ran once and never refreshed on
    // sign-in or sign-out, leaving one user's DayGI state on screen for the next.
  }, [isSignedIn, activeTripId]);

  // Handle active pre-set prompt passed from navigation
  useEffect(() => {
    if (activeDayGiPrompt) {
      handleSendMessage(activeDayGiPrompt);
      setActiveDayGiPrompt(null);
    }
  }, [activeDayGiPrompt]);

  const handleSendMessage = async (promptToSend?: string, displayText?: string) => {
    const text = (promptToSend || inputText).trim();
    if (!text || isLoading) return;
    // Chips send a canonical backend query but must echo exactly what the
    // traveler saw on the chip label — never the translated query.
    const echoText = (displayText ?? text).trim();

    const userMsgId = `msg-user-${Date.now()}`;
    const newMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: echoText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      askedWhileViewing: viewingLabel
    };

    setMessages((prev) => [...prev, newMsg]);
    if (!promptToSend) setInputText('');
    setIsLoading(true);
    setStreamingText(null);
    waitStartedAtRef.current = Date.now();
    const aborter = new AbortController();
    streamAbortRef.current = aborter;

    if (isSignedIn) {
      api.trackDayGiEvent('prompt_submitted', { prompt: text, location: currentLocation, availableMinutes });
      api.trackDayGiFunnel({
        sessionId: sessionIdRef.current,
        tripId: activeTripId,
        step: 'INTENT_ENTERED',
        language: lang
      });
    }

    try {
      const startTime = Date.now();
      const queryContext = {
        prompt: text,
        language: lang,
        currentLocation,
        availableMinutes,
        userPace: profile.pace || 'Balanced',
        userBudget: profile.budget || 'Moderate',
        interests: profile.interests,
        activeBookingsCount: bookings.length,
        activeTripTitle: tripBrief ? `${tripBrief.durationDays}-Day ${tripBrief.tripDynamic} Trip` : 'Dahab Discovery',
        chatId: activeChatId || undefined,
        travelersCount,
        travelDates: travelDates || undefined,
        conversationHistory: messages
          .filter(m => m.id !== 'msg-welcome')
          .slice(-6)
          .map(m => ({ role: m.sender === 'user' ? ('user' as const) : ('assistant' as const), content: m.text }))
      };
      let response: DayGiResponse;
      let usedStream = false;
      try {
        // Preferred path: the server paces the final reply text over SSE.
        // Any failure BEFORE the first text chunk (offline, proxy buffering,
        // missing body) is DayGiStreamUnavailable and falls back cleanly.
        response = await api.queryDayGiStream(queryContext, {
          onText: (full) => {
            streamingTextRef.current = full;
            const elapsed = Date.now() - waitStartedAtRef.current;
            if (elapsed >= WAIT_PHASE_MIN_MS) {
              setStreamingText(full);
              return;
            }
            // Too fast to perceive the wait phase — hold the first chunk for
            // the remainder so the status bubble actually paints.
            pendingFirstChunkRef.current = full;
            if (firstChunkTimerRef.current == null) {
              firstChunkTimerRef.current = setTimeout(() => {
                firstChunkTimerRef.current = null;
                const pending = pendingFirstChunkRef.current;
                pendingFirstChunkRef.current = null;
                if (pending != null) setStreamingText(pending);
              }, WAIT_PHASE_MIN_MS - elapsed);
            }
          },
          signal: aborter.signal
        });
        usedStream = true;
        if (firstChunkTimerRef.current != null) {
          clearTimeout(firstChunkTimerRef.current);
          firstChunkTimerRef.current = null;
        }
        pendingFirstChunkRef.current = null;
        setStreamingText(null);
      } catch (streamErr) {
        if (firstChunkTimerRef.current != null) {
          clearTimeout(firstChunkTimerRef.current);
          firstChunkTimerRef.current = null;
        }
        pendingFirstChunkRef.current = null;
        setStreamingText(null);
        if (!(streamErr instanceof DayGiStreamUnavailable)) throw streamErr;
        response = await api.queryDayGi(queryContext, { signal: aborter.signal });
      }
      const latencyMs = Date.now() - startTime;

      // The server records this exchange into a saved chat; carry its id so
      // the next turn continues the same conversation.
      if (response.chatId) {
        setActiveChatId(response.chatId);
      }

      const daygiMsg: ChatMessage = {
        id: `msg-daygi-${Date.now()}`,
        sender: 'daygi',
        text: lang === 'ar' ? (response.replyTextAr || response.replyText) : response.replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        responsePayload: response
      };

      setMessages((prev) => [...prev, daygiMsg]);
      // The client-side reveal only makes sense for the non-stream path —
      // an SSE reply is already paced out by the server.
      if (!usedStream) {
        setStreamedMessageId(daygiMsg.id);
      }

      // Instrument INTENT_UNDERSTOOD & RECOMMENDATION_SHOWN. Funnel events
      // are attributed server-side, so a signed-out ask has nothing to record.
      if (isSignedIn) {
        api.trackDayGiFunnel({
          sessionId: sessionIdRef.current,
          tripId: activeTripId,
          step: 'INTENT_UNDERSTOOD',
          intentKey: response.parsedIntent?.intent || response.actionType,
          confidenceScore: response.parsedIntent?.confidence || 0.94,
          latencyMs,
          language: lang
        });

        if (response.multiOptions || response.orchestratedTask || response.multiActionConfirmation) {
          api.trackDayGiFunnel({
            sessionId: sessionIdRef.current,
            tripId: activeTripId,
            step: 'RECOMMENDATION_SHOWN',
            intentKey: response.parsedIntent?.intent || response.actionType,
            language: lang
          });
        }
      }
      
      // Update health if included in response
      if (response.tripHealth) {
        setTripHealth(response.tripHealth);
      }

      // If response generated an orchestrated task, track it in task pool
      if (response.orchestratedTask) {
        setOrchestratedTasks((prev) => {
          const filtered = prev.filter(t => t.taskId !== response.orchestratedTask!.taskId);
          return [response.orchestratedTask!, ...filtered];
        });
      }

      if (isSignedIn) {
        api.trackDayGiEvent('recommendation_viewed', {
          mode: response.mode,
          actionType: response.actionType,
          actionTitle: response.actionTitle
        });
      }
    } catch (err: any) {
      console.warn('DayGI query error:', err);
      setStreamingText(null);
      if (err?.name === 'AbortError') {
        // A deliberate Stop. When text had already streamed, it commits as a
        // plain reply (no cards, no canvas — the payload never landed).
        // Stopped before anything arrived, it leaves just the question
        // standing: no error message for an act the traveler chose.
        if (streamingTextRef.current) {
          const partialMsg: ChatMessage = {
            id: `msg-daygi-partial-${Date.now()}`,
            sender: 'daygi',
            text: streamingTextRef.current,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setMessages((prev) => [...prev, partialMsg]);
        }
      } else {
        const fallbackMsg: ChatMessage = {
          id: `msg-daygi-fallback-${Date.now()}`,
          sender: 'daygi',
          text: tc('daygi.queryFailed'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      }
    } finally {
      streamAbortRef.current = null;
      if (firstChunkTimerRef.current != null) {
        clearTimeout(firstChunkTimerRef.current);
        firstChunkTimerRef.current = null;
      }
      pendingFirstChunkRef.current = null;
      // The ref only carries meaning inside a turn; a stale value here would
      // let a later, unrelated abort commit the previous answer's text.
      streamingTextRef.current = null;
      setIsLoading(false);
    }
  };

  const handleExecuteTaskStep = async (taskId: string, stepId: string, actionToken: string) => {
    setExecutingStepId(stepId);
    api.trackDayGiFunnel({
      sessionId: sessionIdRef.current,
      tripId: activeTripId,
      step: 'ACTION_EXECUTED',
      actionType: 'ORCHESTRATED_STEP',
      language: lang
    });

    try {
      const updatedTask = await api.executeDayGiTaskStep(taskId, stepId, actionToken);
      
      // Update task in state and in message payloads
      setOrchestratedTasks(prev => prev.map(t => t.taskId === taskId ? updatedTask : t));
      setMessages(prev => prev.map(m => {
        if (m.responsePayload?.orchestratedTask?.taskId === taskId) {
          return {
            ...m,
            responsePayload: {
              ...m.responsePayload,
              orchestratedTask: updatedTask
            }
          };
        }
        return m;
      }));

      // If step changed trip schedule, reflect immediately
      const executedStep = updatedTask.steps.find((s: DayGiOrchestratedStep) => s.stepId === stepId);
      if (executedStep?.actionKey === 'APPLY_TRIP_SHIFT' && executedStep.payload) {
        const { activityId = 'act-canyon-dive', fromDay = 3, toDay = 4, newTimeSlot = '10:00 AM' } = executedStep.payload;
        shiftActivityBetweenDays(activityId, fromDay, toDay, newTimeSlot);
      }

      // Funnel: ACTION_VERIFIED, TRIP_UPDATED, USER_OUTCOME
      api.trackDayGiFunnel({
        sessionId: sessionIdRef.current,
        tripId: activeTripId,
        step: 'ACTION_VERIFIED',
        actionType: executedStep?.actionKey,
        language: lang
      });
      api.trackDayGiFunnel({
        sessionId: sessionIdRef.current,
        tripId: activeTripId,
        step: 'TRIP_UPDATED',
        language: lang
      });
      api.trackDayGiFunnel({
        sessionId: sessionIdRef.current,
        tripId: activeTripId,
        step: 'USER_OUTCOME',
        language: lang
      });

      showToast(
        tc('dayGi.stepExecutedVerified', {
          name: lang === 'ar'
            ? (executedStep?.nameAr || executedStep?.name || '')
            : (executedStep?.name || ''),
        })
      );
      api.trackDayGiEvent('task_step_executed', { taskId, stepId, status: updatedTask.state });
    } catch (err: any) {
      showToast(err.message || 'Task step execution failed');
    } finally {
      setExecutingStepId(null);
    }
  };

  const handleApplyTaskRecovery = async (taskId: string, recoveryOptionId: string) => {
    setRecoveryInProgress(recoveryOptionId);
    try {
      const updatedTask = await api.applyDayGiTaskRecovery(taskId, recoveryOptionId);
      setOrchestratedTasks(prev => prev.map(t => t.taskId === taskId ? updatedTask : t));
      setMessages(prev => prev.map(m => {
        if (m.responsePayload?.orchestratedTask?.taskId === taskId) {
          return {
            ...m,
            responsePayload: {
              ...m.responsePayload,
              orchestratedTask: updatedTask
            }
          };
        }
        return m;
      }));

      showToast(
        tc('daygi.recoveryPlanAppliedWith')
      );
    } catch (err: any) {
      showToast(err.message || 'Recovery application failed');
    } finally {
      setRecoveryInProgress(null);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      const updatedTask = await api.cancelDayGiTask(taskId, 'User requested cancellation');
      setOrchestratedTasks(prev => prev.map(t => t.taskId === taskId ? updatedTask : t));
      setMessages(prev => prev.map(m => {
        if (m.responsePayload?.orchestratedTask?.taskId === taskId) {
          return {
            ...m,
            responsePayload: {
              ...m.responsePayload,
              orchestratedTask: updatedTask
            }
          };
        }
        return m;
      }));
      showToast(tc('daygi.taskSafelyCancelled'));
    } catch (err: any) {
      showToast(err.message || 'Cancel failed');
    }
  };

  const handleFeedback = async (msgId: string, isPositive: boolean, reasonTag?: string) => {
    // Snapshot the previous selection so a failed submit can restore exactly
    // what the traveler had chosen (usually nothing).
    const previous = (() => {
      const m = messages.find(x => x.id === msgId);
      return { liked: m?.liked, disliked: m?.disliked };
    })();

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId) {
          return {
            ...m,
            liked: isPositive ? true : false,
            disliked: !isPositive ? true : false
          };
        }
        return m;
      })
    );

    const msg = messages.find(m => m.id === msgId);
    const intentKey = msg?.responsePayload?.parsedIntent?.intent || msg?.responsePayload?.actionType || 'CONVERSATION';

    try {
      await api.submitDayGiBetaFeedback({
        messageId: msgId,
        tripId: activeTripId,
        rating: isPositive ? 'HELPFUL' : 'NOT_HELPFUL',
        reasonTag,
        intentKey,
        language: lang
      });
      setFeedbackReasonOpenId(null);
      showToast(isPositive ? (tc('daygi.thankYouFeedbackRecorded')) : (tc('daygi.feedbackNotedToImprove')));
    } catch {
      // A failed submit must never look recorded: undo the selection and say so.
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId
          ? { ...m, liked: previous.liked, disliked: previous.disliked }
          : m))
      );
      setFeedbackReasonOpenId(null);
      showToast(tc('daygi.feedbackFailed'));
    }
  };

  const handleExecuteAction = async (msgId: string, actionKey: string, payload: any) => {
    setExecutingActionId(msgId);
    api.trackDayGiFunnel({
      sessionId: sessionIdRef.current,
      tripId: activeTripId,
      step: 'ACTION_EXECUTED',
      actionType: actionKey,
      language: lang
    });

    try {
      const result = await api.executeDayGiAction({
        actionKey,
        payload
      });

      if (actionKey === 'APPLY_TRIP_SHIFT' && payload) {
        const { activityId = 'act-canyon-dive', fromDay = 3, toDay = 4, newTimeSlot = '10:00 AM' } = payload;
        shiftActivityBetweenDays(activityId, fromDay, toDay, newTimeSlot);
      }

      setMessages(prev => prev.map(m => {
        if (m.id === msgId) {
          return {
            ...m,
            actionExecuted: true,
            executionResult: result
          };
        }
        return m;
      }));

      // Refresh health
      const healthRes = await api.getDayGiTripHealth(activeTripId).catch(() => null);
      if (healthRes) setTripHealth(healthRes);

      api.trackDayGiFunnel({
        sessionId: sessionIdRef.current,
        tripId: activeTripId,
        step: 'ACTION_VERIFIED',
        actionType: actionKey,
        language: lang
      });
      api.trackDayGiFunnel({
        sessionId: sessionIdRef.current,
        tripId: activeTripId,
        step: 'TRIP_UPDATED',
        language: lang
      });
      api.trackDayGiFunnel({
        sessionId: sessionIdRef.current,
        tripId: activeTripId,
        step: 'USER_OUTCOME',
        language: lang
      });

      showToast(lang === 'ar' ? result.messageAr : result.messageEn);
      api.trackDayGiEvent('action_executed_success', { actionKey, auditLogId: result.auditLogId });
    } catch (err: any) {
      showToast(err.message || 'Action execution error');
    } finally {
      setExecutingActionId(null);
    }
  };

  const handleUpdatePreferences = async (newPrefs: any) => {
    try {
      const updated = await api.updateDayGiMemory(newPrefs);
      setUserMemory(updated);
      showToast(tc('daygi.structuredMemoryPreferencesUpdated'));
    } catch (e: any) {
      showToast('Error updating preferences');
    }
  };

  const handleOpenBookingHandoff = (skuId: string = 'SKU-DIV-001') => {
    setSelectedSkuId(skuId);
    setBookModalOpen(true);
    api.trackDayGiEvent('booking_handoff', { skuId });
  };

  /*
   * Quick prompts and slash commands.
   *
   * The display titles live in the i18n catalog (daygi.quickPrompt1..8).
   * Each query is a classifier input in the traveler's language: the same
   * stems the intent lists already match ("after diving" / "بعد الغطس",
   * "trip health", "2000"). Sending the Arabic string on an English screen
   * put Arabic in the traveler's own bubble.
   */
  const QUICK_PROMPTS = [
    { titleKey: 'daygi.quickPrompt1', query: { en: 'I want somewhere calm after diving', ar: 'عايز حاجة هادية بعد الغطس' } },
    { titleKey: 'daygi.quickPrompt2', query: { en: 'What changed in my trip?', ar: 'إيه اللي اتغير في الرحلة؟' } },
    { titleKey: 'daygi.quickPrompt3', query: { en: 'Check my trip health', ar: 'افحص صحة الرحلة والجدول' } },
    { titleKey: 'daygi.quickPrompt4', query: { en: 'Save 2000 EGP on my budget', ar: 'وفّرلي 2000 جنيه' } },
    { titleKey: 'daygi.quickPrompt5', query: { en: 'Make tomorrow more relaxed, I do not want an early start', ar: 'خلّي بكرة أهدى ومش عايز أصحى بدري' } },
    { titleKey: 'daygi.quickPrompt6', query: { en: 'Book me a Canyon dive for tomorrow morning', ar: 'احجز لي غطسة كانيون لبكرة الصبح' } },
    { titleKey: 'daygi.quickPrompt7', query: { en: 'The dive was cancelled because of the wind', ar: 'الغطسة اتلغت بسبب الرياح' } },
    { titleKey: 'daygi.quickPrompt8', query: { en: 'I have two hours near Lighthouse, what should I do now?', ar: 'معايا ساعتين وأنا قريب من اللايتهاوس، أعمل إيه؟' } }
  ];

  const SLASH_COMMANDS = [
    { cmd: '/brief', titleKey: 'daygi.slashBriefLabel', query: { en: 'Good morning, show my daily briefing for today', ar: 'موجز اليوم' } },
    { cmd: '/health', titleKey: 'daygi.slashHealthLabel', query: { en: 'Check my trip health', ar: 'افحص صحة الرحلة والجدول' } },
    { cmd: '/calm', titleKey: 'daygi.slashCalmLabel', query: { en: 'I want somewhere calm after diving', ar: 'عايز حاجة هادية بعد الغطس' } },
    { cmd: '/budget', titleKey: 'daygi.slashBudgetLabel', query: { en: 'Help me save on my trip budget', ar: 'وفّرلي من ميزانية الرحلة' } },
    { cmd: '/changes', titleKey: 'daygi.slashChangesLabel', query: { en: 'What changed today?', ar: 'إيه اللي اتغير في الرحلة؟' } }
  ];

  const slashMenuOpen = inputText.startsWith('/') && !inputText.includes(' ');
  const slashMatches = slashMenuOpen
    ? SLASH_COMMANDS.filter(command => command.cmd.startsWith(inputText.trim().toLowerCase()))
    : [];

  /*
    "@" place mentions — TripAdvisor's composer tip, mapped onto the same five
    Dahab spots the location chip uses. The menu shows while the composer ends
    with an "@fragment"; choosing a spot replaces the fragment with the spot's
    canonical (English) name, which is the same vocabulary the rest of the
    system speaks.
  */
  const MENTION_SPOTS: Array<{ labelKey: string; insert: string }> = [
    { labelKey: 'daygi.lighthouse', insert: 'Lighthouse' },
    { labelKey: 'daygi.eelGarden', insert: 'Eel Garden' },
    { labelKey: 'daygi.theCanyon', insert: 'The Canyon' },
    { labelKey: 'daygi.blueHole', insert: 'Blue Hole' },
    { labelKey: 'daygi.laguna', insert: 'Laguna' }
  ];
  const mentionFragment = /@([^\s@]*)$/u.exec(inputText);
  const mentionMatches = mentionFragment
    ? MENTION_SPOTS.filter(spot => spot.insert.toLowerCase().startsWith(mentionFragment[1].toLowerCase()))
    : [];

  const handleMentionSelect = (id: string) => {
    setInputText(prev => prev.replace(/@([^\s@]*)$/u, `${id} `));
    composerInputRef.current?.focus();
  };

  const handleComposerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.startsWith('/')) {
      const match = SLASH_COMMANDS.find(command => command.cmd === inputText.trim().toLowerCase());
      if (match) {
        setInputText('');
        handleSendMessage(
          lang === 'ar' ? match.query.ar : match.query.en,
          tc(match.titleKey)
        );
      } else {
        showToast(tc('daygi.slashUnknown'));
      }
      return;
    }
    handleSendMessage();
  };

  /* ----------------------------------------------------------------
     Derived view state for the command bar and the desktop context rail.
     ---------------------------------------------------------------- */
  /*
   * Null until the server has actually scored this trip.
   *
   * This was `?? 94`, so a signed-out visitor with no trip was shown
   * "94% — Every booking is confirmed and nothing clashes" about bookings
   * that do not exist. A score is a measurement or it is nothing — and a
   * NO_TRIP health (score 0) is also nothing worth rendering as a percentage.
   */
  const healthScore = tripHealth && tripHealth.status !== 'NO_TRIP' ? tripHealth.score : null;
  const openIssues = tripHealth?.issues?.length ?? 0;
  const liveSuggestions = proactiveSuggestions.filter((s) => !s.dismissed);
  const activeTasks = orchestratedTasks.filter(
    (t) => t.state !== 'COMPLETED' && t.state !== 'CANCELLED'
  );

  /**
   * Escape closes the top-most overlay.
   *
   * Both inspectors were plain divs with no dialog semantics and no keyboard
   * exit: once open, the only way out was the mouse, and screen readers were
   * never told a dialog had appeared.
   */
  useEffect(() => {
    if (!healthModalOpen && !memoryModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (memoryModalOpen) setMemoryModalOpen(false);
      else setHealthModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [healthModalOpen, memoryModalOpen]);

  const getRiskBadge = (risk?: DayGiActionRisk) => {
    switch (risk) {
      case 'SAFETY_CRITICAL':
        return (
          <span className="bg-[var(--dg-risk)]/18 border border-[var(--dg-risk)]/40 text-[var(--dg-risk)] text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />
            {tc('daygi.safetyCritical')}
          </span>
        );
      case 'FINANCIAL':
        return (
          <span className="bg-[var(--dg-fin)]/18 border border-[var(--dg-fin)]/40 text-[var(--dg-fin)] text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <DollarSign className="w-2.5 h-2.5" />
            {tc('daygi.ledgerProtected')}
          </span>
        );
      case 'COMMERCE':
        return (
          <span className="bg-[var(--dg-warn)]/18 border border-[var(--dg-warn)]/40 text-[var(--dg-warn)] text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <ShoppingBag className="w-2.5 h-2.5" />
            {tc('daygi.commerceHold')}
          </span>
        );
      case 'LOW_RISK':
        return (
          <span className="bg-[var(--dg-info)]/18 border border-[var(--dg-info)]/40 text-[var(--dg-info)] text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <SlidersHorizontal className="w-2.5 h-2.5" />
            {tc('daygi.lowRiskShift')}
          </span>
        );
      case 'READ_ONLY':
      default:
        return (
          <span className="bg-[var(--dg-ok)]/18 border border-[var(--dg-ok)]/40 text-[var(--dg-ok)] text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Check className="w-2.5 h-2.5" />
            {tc('daygi.readOnlyFact')}
          </span>
        );
    }
  };

  const getModeBadge = (mode?: 'DISCOVER' | 'PLAN' | 'ACT') => {
    switch (mode) {
      case 'ACT':
        return (
          <span className="bg-[var(--dg-ok)]/18 border border-[var(--dg-ok)]/40 text-[var(--dg-ok)] text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Zap className="w-2.5 h-2.5" />
            {tc('daygi.directActionACT')}
          </span>
        );
      case 'PLAN':
        return (
          <span className="bg-[var(--dg-gold)]/20 border border-[var(--dg-gold)]/40 text-[var(--dg-gold)] text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <SlidersHorizontal className="w-2.5 h-2.5" />
            {tc('daygi.itineraryPlanPLAN')}
          </span>
        );
      case 'DISCOVER':
      default:
        return (
          <span className="bg-[var(--dg-teal)]/20 border border-[var(--dg-teal)]/40 text-[var(--dg-teal)] text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Compass className="w-2.5 h-2.5" />
            {tc('daygi.discoveryDISCOVER')}
          </span>
        );
    }
  };

  return (
    <div
      className="daygi-surface bg-[var(--dg-canvas)] text-[var(--dg-text)] flex flex-col relative h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-5rem)] overflow-hidden"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >


      {/*
        Command bar.

        Previously a single wrapping row inside a max-w-5xl container while the
        transcript below used max-w-4xl, so the brand mark and the language
        toggle hung past both edges of the conversation and nothing lined up.
        It is now two deliberate rows — identity/controls, then trip context —
        inside the same container the transcript uses.
      */}
      <header className="relative z-20 shrink-0 bg-[var(--dg-panel)]/95 backdrop-blur-md border-b border-[var(--dg-line)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6">

          {/* Row 1 — identity, trip health, session controls */}
          <div className="flex items-center justify-between gap-3 py-3">

            {/*
              A name, and that is all.

              This carried a gradient tile, a "3.0" version chip and a line of
              positioning copy — "Watches your trip live, remembers your
              preferences, and runs multi-step tasks only after you approve" —
              re-read on every visit by someone who is here to ask one
              question. A product describes itself once, in onboarding, not
              permanently above the thing it does.
            */}
            <div className="flex items-center gap-1.5 min-w-0">
              {/*
                The way out.

                DayGI is opened from a floating button on top of whatever the
                traveler was doing, and it no longer has a navbar tab holding
                its place — so without this, closing it means guessing which of
                Discover, My Trip or Dahab Live they came from. It returns to
                the actual previous page, and reads "Home" instead of "Back"
                when there is no previous page to promise.
              */}
              <button
                type="button"
                onClick={goBack}
                aria-label={
                  canGoBack
                    ? (tc('daygi.backToThePrevious'))
                    : (tc('daygi.home'))
                }
                className="dg-focus -ms-1.5 w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-[var(--dg-text-2)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-tint)] transition-colors"
              >
                {canGoBack
                  ? <ArrowLeft className="w-4.5 h-4.5 rtl:rotate-180" aria-hidden="true" />
                  : <Home className="w-4.5 h-4.5" aria-hidden="true" />}
              </button>

              <h1 className="text-base font-semibold text-[var(--dg-text)] tracking-tight truncate min-w-0">
                {tc('daygi.dayGI')}
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">

              {/*
                Shown only once the server has actually scored this trip.
                It used to fall back to a hardcoded 94% and render in
                confident green for a signed-out visitor with no bookings.
              */}
              {healthScore !== null && (
                <button
                  onClick={() => setHealthModalOpen(true)}
                  className="dg-focus h-9 px-3 rounded-lg text-xs font-medium text-[var(--dg-text-2)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-tint)] flex items-center gap-1.5 transition-colors"
                  aria-label={tc('daygi.tripHealthPercentOpen', { healthScore })}
                >
                  <HeartPulse className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="dg-num">{healthScore}%</span>
                </button>
              )}

              {/*
                "All chats" — saved conversations. Hidden while signed out:
                history is per-session-user on the server, so a signed-out
                visitor has nothing to list and the request would only 401.
              */}
              {isSignedIn && (
                <button
                  onClick={handleOpenChats}
                  className="dg-focus w-9 h-9 rounded-lg flex items-center justify-center text-[var(--dg-text-2)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-tint)] transition-colors"
                  aria-label={tc('daygi.chatHistory')}
                >
                  <History className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              )}

              {/*
                Share mints a public snapshot link for the saved chat. Hidden
                until the first exchange resolves into a chat id — there is
                nothing persisted to snapshot before that.
              */}
              {activeChatId && (
                <button
                  onClick={handleShareChat}
                  className="dg-focus w-9 h-9 rounded-lg flex items-center justify-center text-[var(--dg-text-2)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-tint)] transition-colors"
                  aria-label={tc('daygi.shareChat')}
                >
                  <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              )}

              {userMemory && (
                <button
                  onClick={() => setMemoryModalOpen(true)}
                  className="dg-focus w-9 h-9 rounded-lg flex items-center justify-center text-[var(--dg-text-2)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-tint)] transition-colors"
                  aria-label={tc('daygi.whatDayGIRemembersAbout')}
                >
                  <Brain className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              )}

              {/*
                Plan canvas toggle — present only while the conversation
                actually carries a plan document; a plan tab with nothing
                behind it is just chrome.
              */}
              {canvasDoc && (
                <button
                  onClick={() => setCanvasOpen(v => !v)}
                  aria-pressed={canvasOpen}
                  aria-label={tc('daygi.canvasShow')}
                  className={`dg-focus w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    canvasOpen
                      ? 'bg-[var(--dg-tint)] text-[var(--dg-text)]'
                      : 'text-[var(--dg-text-2)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-tint)]'
                  }`}
                >
                  <PanelRight className="w-4 h-4 shrink-0 rtl:-scale-x-100" aria-hidden="true" />
                </button>
              )}

              {/* Language */}
              <div
                role="group"
                aria-label={tc('daygi.conciergeLanguage')}
                className="flex items-center bg-[var(--dg-tint)] border border-[var(--dg-line)] p-1 rounded-xl h-9"
              >
                <button
                  onClick={() => setLang('ar')}
                  aria-pressed={lang === 'ar'}
                  className={`dg-focus px-2.5 h-7 rounded-lg text-xs transition-colors ${lang === 'ar' ? 'bg-[var(--dg-panel)] text-[var(--dg-text)] font-semibold shadow-sm' : 'text-[var(--dg-muted)] hover:text-[var(--dg-text)]'}`}
                >
                  ع
                </button>
                <button
                  onClick={() => setLang('en')}
                  aria-pressed={lang === 'en'}
                  className={`dg-focus px-2.5 h-7 rounded-lg text-xs transition-colors ${lang === 'en' ? 'bg-[var(--dg-panel)] text-[var(--dg-text)] font-semibold shadow-sm' : 'text-[var(--dg-muted)] hover:text-[var(--dg-text)]'}`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>

          {/*
            Row 2 — the two facts that change the answer.

            Kept because they are inputs, not decoration: "somewhere calm" means
            something different at the Blue Hole with four hours than at the
            Lighthouse with one. The "Answering for:" label is gone — the
            controls say what they are — and the chips lost their borders and
            fills so the row reads as a setting rather than a second toolbar.
          */}
          <div className="flex items-center gap-1 pb-2.5 overflow-x-auto scrollbar-none">

            <label className="flex items-center gap-1.5 hover:bg-[var(--dg-tint)] ps-2 pe-1 h-8 rounded-lg shrink-0 cursor-pointer transition-colors">
              <MapPin className="w-3.5 h-3.5 text-[var(--dg-muted)] shrink-0" aria-hidden="true" />
              <span className="sr-only">{tc('daygi.yourCurrentLocationIn')}</span>
              <select
                value={currentLocation}
                onChange={(e) => setCurrentLocation(e.target.value)}
                aria-label={tc('daygi.yourCurrentLocationIn')}
                className="dg-focus bg-transparent text-[var(--dg-text-2)] outline-none text-xs cursor-pointer py-1"
              >
                <option value="Lighthouse" className="bg-[var(--dg-panel)] text-[var(--dg-text)]">{tc('daygi.lighthouse')}</option>
                <option value="Eel Garden" className="bg-[var(--dg-panel)] text-[var(--dg-text)]">{tc('daygi.eelGarden')}</option>
                <option value="The Canyon" className="bg-[var(--dg-panel)] text-[var(--dg-text)]">{tc('daygi.theCanyon')}</option>
                <option value="Blue Hole" className="bg-[var(--dg-panel)] text-[var(--dg-text)]">{tc('daygi.blueHole')}</option>
                <option value="Laguna" className="bg-[var(--dg-panel)] text-[var(--dg-text)]">{tc('daygi.laguna')}</option>
              </select>
            </label>

            <label className="flex items-center gap-1.5 hover:bg-[var(--dg-tint)] ps-2 pe-1 h-8 rounded-lg shrink-0 cursor-pointer transition-colors">
              <Clock className="w-3.5 h-3.5 text-[var(--dg-muted)] shrink-0" aria-hidden="true" />
              <span className="sr-only">{tc('daygi.timeYouHaveAvailable')}</span>
              <select
                value={availableMinutes}
                onChange={(e) => setAvailableMinutes(Number(e.target.value))}
                aria-label={tc('daygi.timeYouHaveAvailable')}
                className="dg-focus bg-transparent text-[var(--dg-text-2)] outline-none text-xs cursor-pointer py-1"
              >
                <option value={60} className="bg-[var(--dg-panel)] text-[var(--dg-text)]">{tc('daygi.1FreeHour')}</option>
                <option value={120} className="bg-[var(--dg-panel)] text-[var(--dg-text)]">{tc('daygi.2FreeHours')}</option>
                <option value={180} className="bg-[var(--dg-panel)] text-[var(--dg-text)]">{tc('daygi.3FreeHours')}</option>
                <option value={240} className="bg-[var(--dg-panel)] text-[var(--dg-text)]">{tc('daygi.4FreeHours')}</option>
              </select>
            </label>

            {/*
              Removed: a pulsing green "Sea: green flag" pill. It was a literal
              constant — no reading, no timestamp, no source — announcing safe
              water conditions to a diver. /api/telemetry/weather returns the
              real observation; until this reads it, it says nothing.
            */}
          </div>
        </div>
      </header>

      {/* Proactive Suggestion Alert Banner */}
      {!proactiveBannerDismissed && liveSuggestions.length > 0 && (
        <div className="relative z-10 shrink-0 bg-[var(--dg-gold)]/10 border-b border-[var(--dg-gold)]/25">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0 text-[var(--dg-text-2)]">
              <Bell className="w-4 h-4 text-[var(--dg-gold)] shrink-0 motion-safe:animate-pulse" aria-hidden="true" />
              <span className="font-bold text-[var(--dg-gold)] shrink-0">
                {tc('daygi.proactiveAlert')}
              </span>
              <span className="truncate">
                {lang === 'ar' ? liveSuggestions[0].titleAr : liveSuggestions[0].titleEn}
              </span>
              {liveSuggestions.length > 1 && (
                <span className="dg-num shrink-0 text-[var(--dg-muted)] hidden sm:inline">
                  +{liveSuggestions.length - 1}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/*
                Gated on actionKey, which is what the server actually sends
                (see daygiTripHealthService.getProactiveSuggestions). The
                previous gate, `actionTriggerPrompt`, is not part of
                DayGiProactiveSuggestion and was always undefined, so this
                "View Action" button never rendered for any suggestion.
              */}
              {liveSuggestions[0].actionKey && (
                <button
                  onClick={() =>
                    handleExecuteAction(
                      `proactive-${liveSuggestions[0].id}`,
                      liveSuggestions[0].actionKey!,
                      liveSuggestions[0].actionPayload ?? {}
                    )
                  }
                  className="dg-focus bg-[var(--dg-gold)] hover:bg-[var(--dg-gold-hi)] text-[var(--dg-gold-ink)] font-bold px-3 h-8 rounded-lg text-xs flex items-center gap-1 transition-colors"
                >
                  <span>{tc('daygi.viewAction')}</span>
                  <ChevronRight className={`w-3.5 h-3.5 ${lang === 'ar' ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
              )}
              <button
                onClick={() => setProactiveBannerDismissed(true)}
                aria-label={tc('daygi.dismissAlert')}
                className="dg-focus w-8 h-8 rounded-lg flex items-center justify-center text-[var(--dg-muted)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-tint-2)] transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/*
        Work area.

        The view is now a fixed-height app shell: the transcript is the only
        thing that scrolls, so the composer stays reachable no matter how long
        the conversation runs (it used to sit at the bottom of an ever-growing
        page) and the command bar can never be scrolled under the global navbar.
      */}
      <div className={`relative z-10 flex-1 min-h-0 w-full mx-auto px-4 sm:px-6 flex flex-col ${canvasDoc && canvasOpen ? 'max-w-6xl' : 'max-w-3xl'}`}>

        <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row gap-4 min-w-0">

        {/* Main Chat Stream Container */}
        <section
          aria-label={tc('daygi.dayGIConversation')}
          className="flex-1 min-h-0 flex flex-col w-full min-w-0"
        >

        {/* Messages List — announced as a live log so replies reach assistive tech */}
        <div
          ref={transcriptRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label={tc('daygi.conversationTranscript')}
          tabIndex={0}
          /*
            Before the traveler has said anything there is no transcript to
            read, so the greeting sits in the middle of the space rather than
            pinned to the top of an empty column. Once the conversation starts
            it anchors to the top and scrolls normally.
          */
          className={`dg-scroll dg-focus flex-1 min-h-0 overflow-y-auto space-y-7 pe-1 ${
            messages.length <= 1 ? 'flex flex-col justify-center py-6' : 'py-8'
          }`}
        >
          {messages.map((msg) => {
            const isDayGi = msg.sender === 'daygi';
            const payload = msg.responsePayload;
            const isExecuted = msg.actionExecuted;
            const constraints = payload?.constraints;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isDayGi ? 'justify-start' : 'justify-end'} animate-in fade-in-50 duration-300`}
              >
                {isDayGi && (
                  <div className="w-7 h-7 rounded-full border border-[var(--dg-line)] flex items-center justify-center text-[var(--dg-teal)] shrink-0 mt-0.5" aria-hidden="true">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className={`space-y-3 min-w-0 text-[var(--dg-text)] ${isDayGi ? 'flex-1' : 'max-w-[85%]'}`}>

                  {/*
                    The assistant speaks on the page; only the traveler gets a
                    bubble.

                    Both sides used to sit in bordered, shadowed containers —
                    the reply in a panel, the question in a gold gradient — so a
                    conversation read as a stack of receipts. Giving the answer
                    no container is what makes it read as an answer, and it is
                    the one thing every chat interface worth copying does.
                  */}
                  <div
                    className={`text-sm leading-relaxed ${
                      isDayGi
                        ? ''
                        : 'bg-[var(--dg-tint-2)] rounded-2xl rounded-se-md px-4 py-2.5'
                    }`}
                  >
                    {/*
                      The badge row is gone. Every reply carried a mode chip
                      ("Discovery (DISCOVER)"), a risk chip ("Read-Only Fact")
                      and a timestamp — three pieces of system vocabulary above
                      one sentence of actual answer. None of it is what the
                      traveler came to read, and "Just now" on every message in
                      a live conversation is not information.
                    */}
                    <p className="whitespace-pre-line leading-relaxed">
                      {isDayGi && msg.id === streamedMessageId
                        ? <DayGiStreamedText text={msg.text} streaming={true} />
                        : msg.text}
                    </p>
                    {/*
                      "Asked while viewing X" — the page tag under the
                      traveler's bubble. Only user messages carry it, and only
                      when the send-time label exists (resumed history from
                      before this feature simply shows no tag).
                    */}
                    {!isDayGi && msg.askedWhileViewing && (
                      <p className="mt-1.5 text-[10px] text-[var(--dg-muted)]">
                        {tc('daygi.askedWhileViewing', { page: msg.askedWhileViewing })}
                      </p>
                    )}
                    
                    {/* Active Parsed Constraints Pills (MUST_HAVE, PREFER, AVOID) */}
                    {isDayGi && constraints && (constraints.mustHave?.length > 0 || constraints.prefer?.length > 0 || constraints.avoid?.length > 0) && (
                      <div className="mt-3 pt-2.5 border-t border-[var(--dg-line)] flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="text-[var(--dg-muted)] font-semibold">{tc('daygi.activeConstraints')}</span>
                        {constraints.mustHave?.map((c, i) => (
                          <span key={i} className="bg-[var(--dg-ok)]/18 text-[var(--dg-ok)] px-2 py-0.5 rounded border border-[var(--dg-ok)]/32">
                            ✓ {lang === 'ar' ? (constraints.mustHaveAr?.[i] || c) : c}
                          </span>
                        ))}
                        {constraints.prefer?.map((c, i) => (
                          <span key={i} className="bg-[var(--dg-gold)]/20 text-[var(--dg-gold)] px-2 py-0.5 rounded border border-[var(--dg-gold)]/30">
                            ★ {lang === 'ar' ? (constraints.preferAr?.[i] || c) : c}
                          </span>
                        ))}
                        {constraints.avoid?.map((c, i) => (
                          <span key={i} className="bg-[var(--dg-risk)]/18 text-[var(--dg-risk)] px-2 py-0.5 rounded border border-[var(--dg-risk)]/32">
                            ✕ {lang === 'ar' ? (constraints.avoidAr?.[i] || c) : c}
                          </span>
                        ))}
                      </div>
                    )}

                    {/*
                      Removed: a "Verified Cloud SQL Truth" stamp with a
                      freshness line. The store is a JSON file, there is no
                      Cloud SQL in the read path, and a confidence badge on an
                      unverifiable answer buys trust it has not earned. When a
                      reply rests on something specific, the reply says so in
                      words.
                    */}
                  </div>

                  {/* DayGI Structured Action & Rationale Cards */}
                  {isDayGi && payload && (
                    <div className="space-y-3">
                      
                      {/*
                        The reasoning now reads as a quiet line under the
                        answer instead of a bordered, titled, teal-accented
                        card. It is a footnote, and it was formatted like a
                        second headline.
                      */}
                      {(payload.whyThis || payload.whyThisAr) && (
                        <p className="text-xs leading-relaxed text-[var(--dg-muted)] ps-0.5">
                          {lang === 'ar' ? (payload.whyThisAr || payload.whyThis) : payload.whyThis}
                        </p>
                      )}

                      {/* Task Plan Progress Pipeline (Multi-Step Task Execution) */}
                      {payload.taskPlan && (
                        <div className="bg-[var(--dg-panel)] border border-[var(--dg-teal)]/40 rounded-xl p-3.5 space-y-2.5 shadow-md">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[var(--dg-text)] text-xs flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-[var(--dg-teal)]" />
                              <span>{lang === 'ar' ? payload.taskPlan.titleAr : payload.taskPlan.title}</span>
                            </span>
                            <span className="text-[11px] text-[var(--dg-muted)] font-mono">
                              <span className="dg-num">{payload.taskPlan.steps.filter(s => s.status === 'EXECUTED').length} / {payload.taskPlan.steps.length}</span> {tc('daygi.done')}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {payload.taskPlan.steps.map((step) => (
                              <div 
                                key={step.stepNumber} 
                                className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg border ${
                                  step.status === 'EXECUTED' 
                                    ? 'bg-[var(--dg-ok-well)] border-[var(--dg-ok)]/32 text-[var(--dg-ok)]'
                                    : step.status === 'READY_FOR_CONFIRMATION'
                                    ? 'bg-[var(--dg-gold)]/10 border-[var(--dg-gold)]/40 text-[var(--dg-gold)]'
                                    : 'bg-[var(--dg-tint)] border-[var(--dg-line-soft)] text-[var(--dg-muted)]'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-4 h-4 rounded-full bg-[var(--dg-tint-2)] flex items-center justify-center text-[11px] font-bold">
                                    {step.stepNumber}
                                  </span>
                                  <span>{lang === 'ar' ? step.labelAr : step.labelEn}</span>
                                </div>
                                <span className="text-[11px] font-mono bg-[var(--dg-well)] px-1.5 py-0.5 rounded">
                                  {step.systemComponent}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Execution confirmation pill if action was triggered */}
                      {isExecuted && (
                        <div className="bg-[var(--dg-ok-well)] border border-[var(--dg-ok)]/50 text-[var(--dg-ok)] rounded-xl p-3 text-xs flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[var(--dg-ok)] shrink-0" />
                          <div>
                            <span className="font-bold block text-[var(--dg-ok)]">
                              {tc('daygi.actionExecutedAuditedIn')}
                            </span>
                            <span className="text-[12px] text-[var(--dg-ok)]/80">
                              {lang === 'ar' ? msg.executionResult?.messageAr : msg.executionResult?.messageEn}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* -------------------------------------------------------- */}
                      {/* 1. MULTI-STEP POST-ACTIVITY OPTIONS (3 Candidates)      */}
                      {/* -------------------------------------------------------- */}
                      {payload.actionType === 'MULTI_STEP_OPTIONS' && payload.multiOptions && (
                        <div className="bg-gradient-to-br from-[var(--dg-panel-2)] to-[var(--dg-panel)] border border-[var(--dg-teal)]/50 rounded-xl p-4 shadow-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-[var(--dg-teal)] font-bold block">
                              {tc('daygi.3VerifiedPostDiveOptions')}
                            </span>
                            <span className="text-[12px] text-[var(--dg-gold)] font-semibold">
                              <span className="dg-num">{payload.multiOptions.postActivityContext?.endTime}</span> @ <span dir="auto">{payload.multiOptions.postActivityContext?.location}</span>
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-2.5">
                            {payload.multiOptions.options.map((opt, idx) => (
                              <div 
                                key={opt.id} 
                                className="bg-[var(--dg-tint)] hover:bg-[var(--dg-tint-2)] border border-[var(--dg-line)] rounded-xl p-3 text-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] space-y-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="w-5 h-5 rounded-full bg-[var(--dg-gold)] text-[var(--dg-gold-ink)] font-bold flex items-center justify-center text-[11px]">
                                        {idx + 1}
                                      </span>
                                      <h4 className="font-bold text-[var(--dg-text)] text-xs">
                                        {lang === 'ar' ? opt.titleAr : opt.titleEn}
                                      </h4>
                                    </div>
                                    <p className="text-[12px] text-[var(--dg-text-2)] mt-1 leading-relaxed">
                                      {lang === 'ar' ? opt.whyItFitsAr : opt.whyItFitsEn}
                                    </p>
                                  </div>
                                  <div className="text-end shrink-0">
                                    <span className="font-bold text-[var(--dg-gold)] text-xs block">
                                      <span className="dg-num">{opt.priceEGP} EGP</span>
                                    </span>
                                    <span className="text-[11px] text-[var(--dg-teal)] flex items-center gap-1 justify-end">
                                      <Clock className="w-2.5 h-2.5" />
                                      {opt.travelTimeMins} {tc('daygi.minWalk')}
                                    </span>
                                  </div>
                                </div>

                                {!isExecuted && (
                                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--dg-line-soft)]">
                                    <button
                                      onClick={() => handleExecuteAction(msg.id, 'CONFIRM_DIRECT_BOOKING', {
                                        skuId: opt.skuId,
                                        priceEGP: opt.priceEGP,
                                        title: opt.titleEn
                                      })}
                                      disabled={executingActionId === msg.id}
                                      className="bg-gradient-to-r bg-[var(--dg-ok)] hover:brightness-110 text-[var(--dg-text)] font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] active:scale-[0.99] disabled:opacity-50"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>{tc('dayGi.bookOptionNext', { idx: idx + 1 })}</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* -------------------------------------------------------- */}
                      {/* 2. "WHAT CHANGED?" DIFFERENTIAL CARD                      */}
                      {/* -------------------------------------------------------- */}
                      {payload.actionType === 'WHAT_CHANGED' && payload.whatChanged && (
                        <div className="bg-gradient-to-br from-[var(--dg-panel)] via-[var(--dg-panel)] to-[var(--dg-panel)] border border-[var(--dg-warn)]/45 rounded-xl p-4 shadow-xl space-y-3">
                          <div className="flex items-center gap-2 text-[var(--dg-warn)] text-xs font-bold">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{tc('daygi.differentialChangeResponse')}</span>
                          </div>

                          <div className="space-y-1 text-xs">
                            <div className="bg-[var(--dg-tint)] p-2.5 rounded-lg space-y-1">
                              <span className="text-[var(--dg-muted)] block text-[11px] font-bold">{tc('daygi.whatChanged')}</span>
                              <span className="text-[var(--dg-text)] font-medium">{lang === 'ar' ? payload.whatChanged.whatChangedAr : payload.whatChanged.whatChangedEn}</span>
                            </div>
                            <div className="bg-[var(--dg-tint)] p-2.5 rounded-lg space-y-1">
                              <span className="text-[var(--dg-muted)] block text-[11px] font-bold">{tc('daygi.whatDoesItAffect')}</span>
                              <span className="text-[var(--dg-risk)] font-semibold">{lang === 'ar' ? payload.whatChanged.whatItAffectsAr : payload.whatChanged.whatItAffectsEn}</span>
                            </div>
                          </div>

                          <div className="space-y-2 pt-1">
                            <span className="text-[12px] font-bold text-[var(--dg-text-2)] block">{tc('daygi.availableActionChoices')}</span>
                            {payload.whatChanged.options?.map((opt) => (
                              <div key={opt.id} className="bg-[var(--dg-tint)] hover:bg-[var(--dg-tint-2)] p-2.5 rounded-lg border border-[var(--dg-line)] flex items-center justify-between gap-2 text-xs">
                                <div>
                                  <span className="font-bold text-[var(--dg-text)] block">{lang === 'ar' ? opt.titleAr : opt.titleEn}</span>
                                  <span className="text-[12px] text-[var(--dg-muted)]">{lang === 'ar' ? opt.scheduleImpactAr : opt.scheduleImpactEn}</span>
                                </div>
                                {!isExecuted && (
                                  <button
                                    onClick={() => handleExecuteAction(msg.id, opt.actionKey, opt.actionPayload)}
                                    disabled={executingActionId === msg.id}
                                    className="bg-[var(--dg-gold)] hover:bg-[var(--dg-gold-hi)] text-[var(--dg-gold-ink)] font-bold px-3 py-1.5 rounded-lg text-xs shrink-0 transition-[background-color,border-color,color,box-shadow,transform,opacity]"
                                  >
                                    {tc('daygi.select')}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* -------------------------------------------------------- */}
                      {/* 3. MULTI-ACTION 5-STEP CONFIRMATION CARD                 */}
                      {/* -------------------------------------------------------- */}
                      {payload.actionType === 'MULTI_ACTION_CONFIRMATION' && payload.multiActionConfirmation && (
                        <div className="bg-gradient-to-br from-[var(--dg-panel-2)] to-[var(--dg-panel)] border border-[var(--dg-gold)]/40 rounded-xl p-4 shadow-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[var(--dg-text)] text-xs flex items-center gap-1.5">
                              <SlidersHorizontal className="w-4 h-4 text-[var(--dg-gold)]" />
                              <span>{tc('daygi.scheduleShiftConfirmation')}</span>
                            </span>
                            <span className="text-[11px] bg-[var(--dg-gold)]/20 text-[var(--dg-gold)] px-2 py-0.5 rounded-full font-bold">
                              5-Step Audit
                            </span>
                          </div>

                          <div className="bg-[var(--dg-tint)] rounded-lg p-3 text-xs space-y-2">
                            <div className="flex items-center justify-between text-[var(--dg-muted)]">
                              <span>1. {tc('daygi.currentActivity')}</span>
                              <span className="font-semibold text-[var(--dg-risk)] line-through">
                                {lang === 'ar' ? payload.multiActionConfirmation.step1OldItem.titleAr : payload.multiActionConfirmation.step1OldItem.titleEn}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[var(--dg-text-2)]">
                              <span>2. {tc('daygi.newTargetSlot')}</span>
                              <span className="font-bold text-[var(--dg-teal)]">
                                {payload.multiActionConfirmation.step2Alternative.newTime} ({payload.multiActionConfirmation.step2Alternative.supplierName})
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[var(--dg-muted)]">
                              <span>3. {tc('daygi.ledgerImpact')}</span>
                              <span className="font-semibold text-[var(--dg-ok)]">
                                {lang === 'ar' ? payload.multiActionConfirmation.step3PriceVariance.ledgerNoteAr : payload.multiActionConfirmation.step3PriceVariance.ledgerNoteEn}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[var(--dg-muted)]">
                              <span>4. {tc('daygi.pacingImpact')}</span>
                              <span className="font-semibold text-[var(--dg-text-2)]">
                                {lang === 'ar' ? payload.multiActionConfirmation.step4ScheduleImpact.impactSummaryAr : payload.multiActionConfirmation.step4ScheduleImpact.impactSummaryEn}
                              </span>
                            </div>
                          </div>

                          {!isExecuted ? (
                            <button
                              onClick={() => handleExecuteAction(msg.id, payload.multiActionConfirmation!.step5ActionKey, payload.multiActionConfirmation!.step5Payload)}
                              disabled={executingActionId === msg.id}
                              className="w-full bg-[var(--dg-gold)] hover:bg-[var(--dg-gold-hi)] text-[var(--dg-gold-ink)] font-bold py-2.5 px-3 rounded-lg text-xs flex items-center justify-center gap-2 shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] active:scale-[0.99] disabled:opacity-50"
                            >
                              {executingActionId === msg.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                              <span>5. {tc('daygi.confirmCommitShift')}</span>
                            </button>
                          ) : (
                            <div className="text-center text-xs text-[var(--dg-ok)] font-semibold py-1">
                              ✓ {tc('daygi.shiftAppliedToItinerary')}
                            </div>
                          )}
                        </div>
                      )}

                      {/* -------------------------------------------------------- */}
                      {/* 4. TRIP HEALTH AUDIT CARD                                */}
                      {/* -------------------------------------------------------- */}
                      {payload.actionType === 'TRIP_HEALTH' && payload.tripHealth && (
                        <div className="bg-[var(--dg-panel)] border border-[var(--dg-ok)]/40 rounded-xl p-4 shadow-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <HeartPulse className="w-4 h-4 text-[var(--dg-ok)]" />
                              <span className="font-bold text-[var(--dg-text)] text-xs">
                                {tc('daygi.tripHealthReliabilityScore')}
                              </span>
                            </div>
                            <span className="text-sm font-bold text-[var(--dg-ok)] font-mono">
                              <span className="dg-num">{payload.tripHealth.score} / 100</span>
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-[var(--dg-tint)] p-2 rounded-lg">
                              <span className="text-[11px] text-[var(--dg-muted)] block">{tc('daygi.payments')}</span>
                              <span className="text-[var(--dg-ok)] font-bold">
                                {!payload.tripHealth.issues.some((i: DayGiTripHealthIssue) => i.type === 'PAYMENT_PENDING') ? '✓ Verified (100%)' : 'Pending'}
                              </span>
                            </div>
                            <div className="bg-[var(--dg-tint)] p-2 rounded-lg">
                              <span className="text-[11px] text-[var(--dg-muted)] block">{tc('daygi.suppliers')}</span>
                              <span className="text-[var(--dg-ok)] font-bold">
                                {payload.tripHealth.metrics.pendingBookings === 0 ? '✓ Assigned Tier-1' : 'Pending'}
                              </span>
                            </div>
                            <div className="bg-[var(--dg-tint)] p-2 rounded-lg">
                              <span className="text-[11px] text-[var(--dg-muted)] block">{tc('daygi.conflicts')}</span>
                              <span className="text-[var(--dg-ok)] font-bold">
                                {payload.tripHealth.metrics.conflictsCount === 0 ? '✓ 0 Conflicts' : 'Detected'}
                              </span>
                            </div>
                            <div className="bg-[var(--dg-tint)] p-2 rounded-lg">
                              <span className="text-[11px] text-[var(--dg-muted)] block">{tc('daygi.marineFlags')}</span>
                              <span className="text-[var(--dg-ok)] font-bold">
                                {!payload.tripHealth.issues.some((i: DayGiTripHealthIssue) => i.type === 'CONDITION_UNCERTAINTY') ? '✓ CDWS Green' : 'Caution'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* -------------------------------------------------------- */}
                      {/* 5. DIRECT BOOKING CARD / HOLD REVIEW                     */}
                      {/* -------------------------------------------------------- */}
                      {/* 'BOOKING_CONFIRMATION' is not a DayGiActionType, and the
                          reasoning service only ever pairs bookingReview with
                          'BOOKING_CARD' — that second branch was unreachable. */}
                      {payload.actionType === 'BOOKING_CARD' && payload.actionData?.bookingReview && (
                        <div className="bg-gradient-to-br from-[var(--dg-panel-2)] to-[var(--dg-panel)] border border-[var(--dg-teal)]/50 rounded-xl p-4 shadow-xl">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div>
                              <span className="text-[11px] text-[var(--dg-teal)] font-bold block">
                                {tc('daygi.directBookingReview')}
                              </span>
                              <h4 className="font-bold text-[var(--dg-text)] text-sm">
                                {lang === 'ar' ? (payload.actionData.bookingReview.serviceAr || payload.actionTitleAr) : (payload.actionData.bookingReview.service || payload.actionTitle)}
                              </h4>
                              <p className="text-[12px] text-[var(--dg-muted)]">
                                {payload.actionData.bookingReview.supplierName}
                              </p>
                            </div>
                            <div className="text-end">
                              <span className="text-sm font-bold text-[var(--dg-gold)] block">
                                <span className="dg-num">{payload.actionData.bookingReview.priceEGP?.toLocaleString()} EGP</span>
                              </span>
                              <span className="text-[11px] text-[var(--dg-ok)] flex items-center gap-1 justify-end">
                                <Check className="w-2.5 h-2.5" />
                                {tc('daygi.directBestPrice')}
                              </span>
                            </div>
                          </div>

                          <div className="bg-[var(--dg-tint)] rounded-lg p-3 text-xs text-[var(--dg-text-2)] mb-3 space-y-1.5">
                            <div className="flex items-center justify-between text-[var(--dg-muted)]">
                              <span>{tc('daygi.dateSlot')}</span>
                              <span className="font-semibold text-[var(--dg-text)]">{payload.actionData.bookingReview.date} · {payload.actionData.bookingReview.time}</span>
                            </div>
                            <div className="flex items-center justify-between text-[var(--dg-muted)]">
                              <span>{tc('daygi.guests')}</span>
                              <span className="font-semibold text-[var(--dg-text)]">{payload.actionData.bookingReview.people} {tc('daygi.guests-2')}</span>
                            </div>
                            <div className="flex items-center justify-between text-[var(--dg-muted)]">
                              <span>{tc('daygi.cancellation')}</span>
                              <span className="font-semibold text-[var(--dg-text-2)]">{lang === 'ar' ? payload.actionData.bookingReview.cancellationPolicyAr : payload.actionData.bookingReview.cancellationPolicy}</span>
                            </div>
                          </div>

                          {!isExecuted ? (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => handleExecuteAction(msg.id, 'CONFIRM_DIRECT_BOOKING', {
                                  skuId: payload.actionData?.bookingReview?.skuId,
                                  priceEGP: payload.actionData?.bookingReview?.priceEGP
                                })}
                                disabled={executingActionId === msg.id}
                                className="bg-gradient-to-r bg-[var(--dg-ok)] hover:brightness-110 text-[var(--dg-text)] font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] active:scale-[0.99] disabled:opacity-50"
                              >
                                {executingActionId === msg.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                <span>{tc('daygi.confirmHold')}</span>
                              </button>

                              <button
                                onClick={() => handleOpenBookingHandoff(payload.actionData?.bookingReview?.skuId || 'SKU-DIV-001')}
                                className="bg-[var(--dg-gold)] hover:bg-[var(--dg-gold-hi)] text-[var(--dg-gold-ink)] font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] active:scale-[0.99]"
                              >
                                <ShoppingBag className="w-3.5 h-3.5" />
                                <span>{tc('daygi.payNow')}</span>
                              </button>
                            </div>
                          ) : (
                            <div className="text-center text-xs text-[var(--dg-ok)] font-semibold py-1">
                              ✓ {tc('daygi.bookingHeldAndConfirmed')}
                            </div>
                          )}
                        </div>
                      )}

                      {/* -------------------------------------------------------- */}
                      {/* 6. BUDGET SAVINGS CARD                                   */}
                      {/* -------------------------------------------------------- */}
                      {payload.actionType === 'BUDGET_SAVINGS' && payload.actionData?.budgetAnalysis && (
                        <div className="bg-[var(--dg-panel)] border border-[var(--dg-fin)]/40 rounded-xl p-4 shadow-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-[var(--dg-gold)]" />
                              <span className="font-bold text-[var(--dg-text)] text-xs">
                                {tc('daygi.verifiedBudgetOptimization')}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-[var(--dg-ok)]">
                              <span className="dg-num">-{payload.actionData.budgetAnalysis.potentialSavingsEGP} EGP</span>
                            </span>
                          </div>

                          <div className="space-y-2 text-xs">
                            {payload.actionData.budgetAnalysis.adjustableItems?.map((item: any, idx: number) => (
                              <div key={idx} className="bg-[var(--dg-tint)] p-2.5 rounded-lg space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[var(--dg-text-2)] font-medium">{lang === 'ar' ? item.titleAr : item.title}</span>
                                  <span className="dg-num text-[var(--dg-ok)] font-bold">-{item.savingsEGP} EGP</span>
                                </div>
                                <div className="text-[12px] text-[var(--dg-teal)]">
                                  → {lang === 'ar' ? item.lowerCostAlternativeAr : item.lowerCostAlternative}
                                </div>
                              </div>
                            ))}
                          </div>

                          {!isExecuted ? (
                            <button
                              onClick={() => handleExecuteAction(msg.id, 'APPLY_BUDGET_OPTIMIZATION', {})}
                              disabled={executingActionId === msg.id}
                              className="w-full bg-[var(--dg-teal)] hover:bg-[var(--dg-teal-hi)] text-[var(--dg-teal-ink)] font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-[background-color,border-color,color,box-shadow,transform,opacity] disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{tc('daygi.applySavingsOptimizations')}</span>
                            </button>
                          ) : (
                            <div className="text-center text-xs text-[var(--dg-ok)] font-semibold py-1">
                              ✓ {tc('daygi.optimizationsApplied')}
                            </div>
                          )}
                        </div>
                      )}

                      {/* -------------------------------------------------------- */}
                      {/* 7. DAILY BRIEFING CARD                                   */}
                      {/* -------------------------------------------------------- */}
                      {payload.actionType === 'DAILY_BRIEFING' && payload.actionData?.dailyBriefing && (
                        <div className="bg-[var(--dg-panel)] border border-[var(--dg-line)] rounded-xl p-4 shadow-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Compass className="w-4 h-4 text-[var(--dg-teal)]" />
                              <span className="font-bold text-[var(--dg-text)] text-xs">
                                <span dir="auto">{payload.actionData.dailyBriefing.dateFormatted}</span>
                              </span>
                            </div>
                            <span className="text-[11px] bg-[var(--dg-teal)]/20 text-[var(--dg-teal)] px-2 py-0.5 rounded-full font-bold">
                              {tc('daygi.dailyBriefing')}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {payload.actionData.dailyBriefing.timeline?.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-xs bg-[var(--dg-tint)] p-2 rounded-lg">
                                <span className="dg-num font-bold text-[var(--dg-gold)] shrink-0 text-xs w-[70px]">{item.time}</span>
                                <span className="text-[var(--dg-text-2)]">{lang === 'ar' ? item.titleAr : item.title}</span>
                              </div>
                            ))}
                          </div>

                          <div className="bg-[var(--dg-teal)]/10 border border-[var(--dg-teal)]/30 rounded-lg p-2.5 text-xs text-[var(--dg-teal)] flex items-start gap-2">
                            <Waves className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>
                              {lang === 'ar' ? (payload.actionData.dailyBriefing.conditionsNoteAr || payload.actionData.dailyBriefing.conditionsNote) : payload.actionData.dailyBriefing.conditionsNote}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* -------------------------------------------------------- */}
                      {/* 8. DISCOVERY RECOMMENDATIONS / PRACTICAL TIPS            */}
                      {/* -------------------------------------------------------- */}
                      {payload.actionData?.practicalTips && (
                        <div className="bg-[var(--dg-panel)] border border-[var(--dg-line)] rounded-xl p-3 text-xs">
                          <span className="font-bold text-[var(--dg-text)] block mb-1.5 flex items-center gap-1.5">
                            <Compass className="w-3.5 h-3.5 text-[var(--dg-gold)]" />
                            {tc('daygi.practicalLocalAdvice')}
                          </span>
                          <ul className="space-y-1 text-[var(--dg-text-2)] list-disc ltr:pl-4 rtl:pr-4">
                            {(lang === 'ar' ? (payload.actionData.practicalTipsAr || payload.actionData.practicalTips) : payload.actionData.practicalTips).map((tip, idx) => (
                              <li key={idx}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Gemini clarification: specific question with option buttons */}
                      {isDayGi && payload.clarification && payload.clarification.options.length > 0 && (
                        <div className="pt-2 border-t border-[var(--dg-line-soft)] space-y-2">
                          <p className="text-[11px] font-bold text-[var(--dg-teal)]">
                            {tc('daygi.clarificationQuestion')}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {payload.clarification.options.map((opt, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSendMessage(opt.query, lang === 'ar' ? opt.labelAr : opt.labelEn)}
                                className="text-[12px] bg-[var(--dg-teal)]/10 hover:bg-[var(--dg-teal)]/20 border border-[var(--dg-teal)]/30 text-[var(--dg-text)] px-3 py-1.5 rounded-full transition-colors font-medium"
                              >
                                <span>{lang === 'ar' ? opt.labelAr : opt.labelEn}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Follow-up Suggestion Pills */}
                      {payload.suggestedFollowUps && payload.suggestedFollowUps.length > 0 && (
                        <div className="pt-1 flex flex-wrap gap-1.5">
                          {payload.suggestedFollowUps.map((su, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSendMessage(lang === 'ar' ? su.textAr : su.textEn)}
                              className="text-[12px] bg-[var(--dg-tint)] hover:bg-[var(--dg-tint-3)] border border-[var(--dg-line)] text-[var(--dg-text-2)] hover:text-[var(--dg-text)] px-2.5 py-1 rounded-full transition-colors flex items-center gap-1"
                            >
                              <span>{lang === 'ar' ? su.textAr : su.textEn}</span>
                              <ChevronRight className={`w-3 h-3 ${lang === 'ar' ? 'rotate-180' : ''}`} />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Closed Beta Structured Feedback */}
                      <div className="pt-2 border-t border-[var(--dg-line-soft)] space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[var(--dg-muted)]">
                            {tc('daygi.didThisHelpYour')}
                          </span>
                          <button
                            onClick={() => {
                              if (msg.liked) return;
                              setFeedbackReasonOpenId(feedbackReasonOpenId === msg.id ? null : msg.id);
                              handleFeedback(msg.id, true, 'ACCURATE');
                            }}
                            className={`p-1 rounded hover:bg-[var(--dg-tint-2)] text-[var(--dg-muted)] hover:text-[var(--dg-ok)] transition-colors ${msg.liked ? 'text-[var(--dg-ok)] font-bold' : ''}`}
                            title="Helpful"
                            aria-label={tc('daygi.thisAnswerWasHelpful')}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (msg.disliked) return;
                              setFeedbackReasonOpenId(feedbackReasonOpenId === msg.id ? null : msg.id);
                              handleFeedback(msg.id, false, 'TOO_VAGUE');
                            }}
                            className={`p-1 rounded hover:bg-[var(--dg-tint-2)] text-[var(--dg-muted)] hover:text-[var(--dg-risk)] transition-colors ${msg.disliked ? 'text-[var(--dg-risk)] font-bold' : ''}`}
                            title="Needs Improvement"
                            aria-label={tc('daygi.thisAnswerNeedsImprovement')}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* 1-Tap Feedback Detail Tags */}
                        {feedbackReasonOpenId === msg.id && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1 animate-in fade-in duration-200">
                            <span className="text-[11px] text-[var(--dg-muted)]">{tc('daygi.reason')}</span>
                            {[
                              { tag: 'ACCURATE', labelAr: 'دقيق ومباشر', labelEn: 'Accurate' },
                              { tag: 'FAST_RESOLUTION', labelAr: 'سريع وسهل', labelEn: 'Fast' },
                              { tag: 'SAVED_MONEY', labelAr: 'وفّر ميزانية', labelEn: 'Saved Money' },
                              { tag: 'TOO_VAGUE', labelAr: 'غير دقيق', labelEn: 'Vague' },
                              { tag: 'WRONG_LOCATION', labelAr: 'الموقع غير مناسب', labelEn: 'Wrong Spot' }
                            ].map((item) => (
                              <button
                                key={item.tag}
                                onClick={() => handleFeedback(msg.id, msg.liked || true, item.tag)}
                                className="px-2 py-0.5 rounded-md bg-[var(--dg-tint)] hover:bg-[var(--dg-tint-3)] border border-[var(--dg-line)] text-[11px] text-[var(--dg-text-2)] hover:text-[var(--dg-text)] transition-[background-color,border-color,color,box-shadow,transform,opacity]"
                              >
                                {lang === 'ar' ? item.labelAr : item.labelEn}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                </div>
              </div>
            );
          })}

          {/* Loading Indicator — the wait phase before the first chunk lands */}
          {isLoading && streamingText === null && (
            <div className="flex gap-3 justify-start animate-in fade-in-50">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[var(--dg-gold)] to-[var(--dg-teal)] flex items-center justify-center text-[var(--dg-gold-ink)] font-bold shrink-0 mt-1 shadow-md">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-[var(--dg-bubble)] border border-[var(--dg-line)] rounded-2xl p-4 flex items-center gap-2 text-xs text-[var(--dg-text-2)]">
                <Waves className="w-4 h-4 text-[var(--dg-teal)] animate-pulse" />
                <span>{tc('daygi.dayGI30IsMatching')}</span>
              </div>
            </div>
          )}

          {/*
            The streamed reply — the server paces the final answer in word
            boundary chunks; the fresh tail carries the same tinted mark the
            action cards use. Screen readers get the accumulated full text
            (it is one aria-live log region anyway) and never see the
            animated copy.
          */}
          {isLoading && streamingText !== null && (
            <div className="flex gap-3 justify-start animate-in fade-in-50" data-testid="daygi-streaming-text">
              <div className="w-7 h-7 rounded-full border border-[var(--dg-line)] flex items-center justify-center text-[var(--dg-teal)] shrink-0 mt-0.5" aria-hidden="true">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="text-sm leading-relaxed text-[var(--dg-text)] min-w-0">
                <span className="sr-only">{streamingText}</span>
                <span aria-hidden="true">
                  {streamingText.slice(0, Math.max(0, streamingText.length - 60))}
                  <mark className="bg-[var(--dg-tint)] text-[var(--dg-text)] rounded px-0.5 animate-pulse">
                    {streamingText.slice(-60)}
                  </mark>
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/*
          Composer — pinned to the bottom of the column.

          Extra bottom room on small screens: the app's mobile tab bar is fixed
          over the last ~56px of the viewport and used to sit on top of the send
          button.
        */}
        <div className="shrink-0 space-y-2.5 pt-3 pb-20 md:pb-4 bg-gradient-to-t from-[var(--dg-canvas)] via-[var(--dg-canvas)] to-transparent">

          {/*
            Four suggestions, wrapping, and only until the traveler has said
            something.

            All eight used to sit in a horizontal scroller behind a flame icon
            and a "Try:" label, so the last four were permanently off the right
            edge — a row of half-visible buttons is a row nobody reads. They
            also stayed on screen for the whole conversation, still offering
            "Check trip health" twenty messages in.
          */}
          {messages.length <= 1 && (
            <div
              role="group"
              aria-label={tc('daygi.suggestedQuestions')}
              className="flex flex-wrap gap-2"
            >
              {QUICK_PROMPTS.slice(0, 4).map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(
                    lang === 'ar' ? qp.query.ar : qp.query.en,
                    tc(qp.titleKey)
                  )}
                  disabled={isLoading}
                  className="dg-focus bg-[var(--dg-tint)] hover:bg-[var(--dg-tint-2)] text-[var(--dg-text-2)] hover:text-[var(--dg-text)] px-3.5 h-9 rounded-full text-xs transition-colors active:scale-[0.98] disabled:opacity-45"
                >
                  {tc(qp.titleKey)}
                </button>
              ))}
            </div>
          )}

          {/*
            Slash commands — type "/" to see quick actions, TripAdvisor-style.

            The menu only shows while the composer holds a bare "/cmd" token
            (no spaces yet). Submitting an unmatched command is refused with a
            toast rather than silently answered as a normal question, because
            the intent classifier would otherwise mangle it.
          */}
          {slashMatches.length > 0 && (
            <DayGiOptionMenu
              testId="daygi-slash-menu"
              label={tc('daygi.slashMenuLabel')}
              options={slashMatches.map(command => ({
                id: command.cmd,
                badge: command.cmd,
                label: tc(command.titleKey)
              }))}
              onSelect={(id) => {
                const match = SLASH_COMMANDS.find(command => command.cmd === id);
                if (!match) return;
                setInputText('');
                handleSendMessage(
                  lang === 'ar' ? match.query.ar : match.query.en,
                  tc(match.titleKey)
                );
              }}
            />
          )}

          {mentionMatches.length > 0 && (
            <DayGiOptionMenu
              testId="daygi-mention-menu"
              label={tc('daygi.mentionMenuLabel')}
              options={mentionMatches.map(spot => mentionOption(tc(spot.labelKey), spot.insert))}
              onSelect={handleMentionSelect}
            />
          )}

          {/* Composer context chips: dates + travelers */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <DayGiComposerContext
              lang={lang}
              travelDates={travelDates}
              travelersCount={travelersCount}
              onDatesChange={setTravelDates}
              onTravelersChange={setTravelersCount}
            />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleComposerSubmit}
            className="flex items-center gap-2 bg-[var(--dg-tint)] border border-[var(--dg-line)] focus-within:border-[var(--dg-teal)] focus-within:bg-[var(--dg-panel)] rounded-[1.75rem] p-2 transition-colors"
          >
            <input
              ref={composerInputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              aria-label={tc('daygi.messageDayGI')}
              placeholder={
                tc('daygi.askDayGISomewhereCalm')
              }
              className="flex-1 min-w-0 bg-transparent text-[var(--dg-text)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--dg-muted)] truncate"
            />

            {isLoading ? (
              <button
                type="button"
                onClick={handleStopGenerating}
                aria-label={tc('daygi.stopGenerating')}
                className="dg-focus w-10 h-10 rounded-full bg-[var(--dg-teal)] text-[var(--dg-gold-ink)] flex items-center justify-center hover:brightness-110 active:scale-95 transition-[background-color,border-color,color,box-shadow,transform,opacity] shrink-0"
              >
                <Square className="w-4 h-4 fill-current" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputText.trim()}
                aria-label={tc('daygi.sendMessage')}
                className="dg-focus w-10 h-10 rounded-full bg-[var(--dg-teal)] text-[var(--dg-gold-ink)] flex items-center justify-center hover:brightness-110 active:scale-95 transition-[background-color,border-color,color,box-shadow,transform,opacity] disabled:opacity-30 disabled:hover:brightness-100 shrink-0"
              >
                <Send className={`w-4.5 h-4.5 ${lang === 'ar' ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
            )}
          </form>

          {/*
            Clear conversation — removes the persisted transcript (localStorage
            `daygi:chatHistory`) and restarts from the greeting. Only shown
            once there is something to clear.
          */}
          {messages.length > 1 && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleNewChat}
                aria-label={tc('daygi.clearConversation')}
                className="dg-focus flex items-center gap-1 text-[11px] text-[var(--dg-muted)] hover:text-[var(--dg-text)] px-2 py-1 rounded-lg transition-colors"
              >
                <Trash2 className="w-3 h-3" aria-hidden="true" />
                <span>{tc('daygi.clearConversation')}</span>
              </button>
            </div>
          )}

          {/*
            Kept, because it is a real promise about money and the traveler
            should be able to see it before they ask for something expensive.
            Demoted to a plain line: it had a shield icon and centred emphasis,
            which is how a reassurance starts reading as marketing.
          */}
          <p className="text-[11px] text-[var(--dg-muted)] text-center">
            {tc('daygi.composerTip')}
          </p>
          <p className="text-[11px] text-[var(--dg-muted)] text-center">
            {tc('daygi.aiDisclaimer')}
          </p>
          <p className="text-[11px] text-[var(--dg-muted)] text-center">
            {tc('daygi.dayGINeverChangesA')}
          </p>

        </div>

        </section>

        {/*
          The plan canvas rail (desktop).

          The 340px context rail this sits beside is still gone — health,
          memory and tasks open from the header, where a status you consult
          on purpose belongs. The canvas is different: it is the answer
          itself, a structured plan document the traveler reads while the
          conversation continues, so it earns a place in the work area.
        */}
        {canvasDoc && canvasOpen && (
          <aside
            data-testid="daygi-canvas-rail"
            className="hidden lg:flex flex-col min-h-0 w-[400px] shrink-0 overflow-hidden border border-[var(--dg-line)] rounded-2xl bg-[var(--dg-panel)] p-3"
          >
            <DayGiCanvasPanel
              document={canvasDoc}
              lang={lang}
              itemOverrides={canvasOverrides}
              onTogglePin={handleToggleCanvasPin}
              onRemoveItem={handleRemoveCanvasItem}
              onAskAboutItem={handleAskAboutCanvasItem}
              onRegenerate={handleRegenerateCanvas}
              onExecuteItem={handleExecuteCanvasItem}
              onClose={() => setCanvasOpen(false)}
            />
          </aside>
        )}
        </div>

        {/*
          The 340px context rail is gone.

          It held a trip-health ring, a memory panel and a task queue beside
          the conversation — three standing dashboards competing with the
          answer the traveler actually asked for, and on a screen narrower
          than 1280px none of it rendered at all, so the page already had to
          work without them. The same state still opens from the header,
          which is where a status you consult on purpose belongs.
        */}
      </div>

      {/*
        Plan canvas, mobile: the rail has no room under lg, so the same
        document opens as a sheet over the conversation instead of being
        silently unavailable on the screens that need it most.
      */}
      {canvasDoc && canvasOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-[var(--dg-scrim)] backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
          onClick={() => setCanvasOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={tc('daygi.canvasPlanLabel')}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            className="daygi-surface w-full sm:max-w-md max-h-[85vh] rounded-2xl border border-[var(--dg-line)] bg-[var(--dg-panel)] p-3 flex flex-col min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <DayGiCanvasPanel
              document={canvasDoc}
              lang={lang}
              itemOverrides={canvasOverrides}
              onTogglePin={handleToggleCanvasPin}
              onRemoveItem={handleRemoveCanvasItem}
              onAskAboutItem={handleAskAboutCanvasItem}
              onRegenerate={handleRegenerateCanvas}
              onExecuteItem={handleExecuteCanvasItem}
              onClose={() => setCanvasOpen(false)}
            />
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/* MODAL: SAVED CHATS ("ALL CHATS")                        */}
      {/* -------------------------------------------------------- */}
      <DayGiChatHistoryModal
        open={chatsModalOpen}
        chats={chats}
        loading={chatsLoading}
        lang={lang}
        onResume={handleResumeChat}
        onDelete={handleDeleteChat}
        onNewChat={handleNewChat}
        onClose={() => setChatsModalOpen(false)}
      />

      {/* MODAL: SHARE LINK */}
      {/* -------------------------------------------------------- */}
      <DayGiShareModal
        open={shareModalOpen}
        shareUrl={shareUrl}
        creating={shareCreating}
        lang={lang}
        onCopy={handleCopyShareLink}
        onClose={() => setShareModalOpen(false)}
      />

      {/* -------------------------------------------------------- */}
      {/* MODAL: TRIP HEALTH INSPECTOR (7 CRITERIA)                */}
      {/* -------------------------------------------------------- */}
      {healthModalOpen && tripHealth && (
        <div
          className="daygi-surface fixed inset-0 bg-[var(--dg-scrim)] backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setHealthModalOpen(false)}
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dg-health-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--dg-panel)] border border-[var(--dg-teal)]/50 rounded-2xl max-w-lg w-full max-h-[85dvh] overflow-y-auto dg-scroll p-6 space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <HeartPulse className="w-5 h-5 text-[var(--dg-ok)] shrink-0" aria-hidden="true" />
                <h3 id="dg-health-title" className="text-base font-bold text-[var(--dg-text)]">
                  {tc('daygi.7PointTripHealthInspector')}
                </h3>
              </div>
              <button
                onClick={() => setHealthModalOpen(false)}
                autoFocus
                aria-label={tc('attractions.close')}
                className="dg-focus w-9 h-9 shrink-0 grid place-items-center text-[var(--dg-muted)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-tint-2)] rounded-lg transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="bg-[var(--dg-tint)] rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-[var(--dg-muted)] block">{tc('daygi.overallHealthStatus')}</span>
                <span className="text-lg font-bold text-[var(--dg-ok)]" dir="auto">{tripHealth.status} <span className="dg-num">({tripHealth.score} / 100)</span></span>
              </div>
              <div className="dg-num w-12 h-12 rounded-full border-4 border-[var(--dg-ok)] flex items-center justify-center font-bold text-[var(--dg-text)] text-sm">
                {tripHealth.score}%
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--dg-tint)]">
                <span>1. {tc('daygi.paymentVerification')}</span>
                <span className="text-[var(--dg-ok)] font-bold">✓ 100% {tc('daygi.cleared')}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--dg-tint)]">
                <span>2. {tc('daygi.supplierAssignmentSLAs')}</span>
                <span className="text-[var(--dg-ok)] font-bold">✓ {tc('daygi.confirmed')}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--dg-tint)]">
                <span>3. {tc('daygi.scheduleConflictCheck')}</span>
                <span className="text-[var(--dg-ok)] font-bold">✓ 0 {tc('daygi.conflicts-2')}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--dg-tint)]">
                <span>4. {tc('daygi.transitBuffer15Min')}</span>
                <span className="text-[var(--dg-ok)] font-bold">✓ {tc('daygi.optimal')}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--dg-tint)]">
                <span>5. {tc('daygi.decompressionAscentSafety')}</span>
                <span className="text-[var(--dg-ok)] font-bold">✓ {tc('daygi.safeWindow')}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--dg-tint)]">
                <span>6. {tc('daygi.cDWSMarineFlagsWeather')}</span>
                <span className="text-[var(--dg-ok)] font-bold">✓ Green Flag</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--dg-tint)]">
                <span>7. {tc('daygi.hotelAirportTransfers')}</span>
                <span className="text-[var(--dg-ok)] font-bold">✓ {tc('daygi.complete')}</span>
              </div>
            </div>

            <button
              onClick={() => setHealthModalOpen(false)}
              className="dg-focus w-full bg-[var(--dg-gold)] hover:bg-[var(--dg-gold-hi)] text-[var(--dg-gold-ink)] font-bold h-11 rounded-xl text-xs transition-colors"
            >
              {tc('daygi.closeAuditReport')}
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/* MODAL: STRUCTURED MEMORY PREFERENCES                     */}
      {/* -------------------------------------------------------- */}
      {memoryModalOpen && userMemory && (
        <div
          className="daygi-surface fixed inset-0 bg-[var(--dg-scrim)] backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setMemoryModalOpen(false)}
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dg-memory-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--dg-panel)] border border-[var(--dg-gold)]/50 rounded-2xl max-w-lg w-full max-h-[85dvh] overflow-y-auto dg-scroll p-6 space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Brain className="w-5 h-5 text-[var(--dg-gold)] shrink-0" aria-hidden="true" />
                <h3 id="dg-memory-title" className="text-base font-bold text-[var(--dg-text)]">
                  {tc('daygi.dayGIStructuredMemoryPreferences')}
                </h3>
              </div>
              <button
                onClick={() => setMemoryModalOpen(false)}
                autoFocus
                aria-label={tc('attractions.close')}
                className="dg-focus w-9 h-9 shrink-0 grid place-items-center text-[var(--dg-muted)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-tint-2)] rounded-lg transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <p className="text-xs text-[var(--dg-text-2)] leading-relaxed">
              {tc('daygi.dayGIMaintainsExplicitStructured')}
            </p>

            <div className="space-y-3 text-xs">
              
              {/* Pace Toggle */}
              <div className="bg-[var(--dg-tint)] p-3 rounded-xl flex items-center justify-between">
                <span>{tc('daygi.tripPacing')}</span>
                <div className="flex items-center gap-1 bg-[var(--dg-well)] p-1 rounded-lg">
                  {(['Relaxed', 'Balanced', 'Active'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => handleUpdatePreferences({ pace: p })}
                      className={`px-2 py-1 rounded text-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] ${userMemory.preferences.pace === p ? 'bg-[var(--dg-gold)] text-[var(--dg-gold-ink)] font-bold' : 'text-[var(--dg-muted)] hover:text-[var(--dg-text)]'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mornings Preference */}
              <div className="bg-[var(--dg-tint)] p-3 rounded-xl flex items-center justify-between">
                <span>{tc('daygi.morningRoutine')}</span>
                <div className="flex items-center gap-1 bg-[var(--dg-well)] p-1 rounded-lg">
                  <button
                    onClick={() => handleUpdatePreferences({ morningPreference: 'Late_Start' })}
                    className={`px-2 py-1 rounded text-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] ${userMemory.preferences.morningPreference === 'Late_Start' ? 'bg-[var(--dg-teal)] text-[var(--dg-teal-ink)] font-bold' : 'text-[var(--dg-muted)] hover:text-[var(--dg-text)]'}`}
                  >
                    {tc('daygi.after10AM')}
                  </button>
                  <button
                    onClick={() => handleUpdatePreferences({ morningPreference: 'Early_Bird' })}
                    className={`px-2 py-1 rounded text-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] ${userMemory.preferences.morningPreference === 'Early_Bird' ? 'bg-[var(--dg-teal)] text-[var(--dg-teal-ink)] font-bold' : 'text-[var(--dg-muted)] hover:text-[var(--dg-text)]'}`}
                  >
                    {tc('daygi.earlyBird')}
                  </button>
                </div>
              </div>

              {/* Seafood Preference */}
              <div className="bg-[var(--dg-tint)] p-3 rounded-xl flex items-center justify-between">
                <span>{tc('daygi.seafoodDiningPreference')}</span>
                <button
                  onClick={() => handleUpdatePreferences({ seafoodPreference: !userMemory.preferences.seafoodPreference })}
                  className={`px-3 py-1 rounded-lg font-bold text-xs ${userMemory.preferences.seafoodPreference ? 'bg-[var(--dg-ok)]/18 text-[var(--dg-ok)] border border-[var(--dg-ok)]/40' : 'bg-[var(--dg-tint-2)] text-[var(--dg-muted)]'}`}
                >
                  {userMemory.preferences.seafoodPreference ? (tc('daygi.enabled')) : (tc('daygi.disabled'))}
                </button>
              </div>

              {/* Learned Insights */}
              {userMemory.learnedInsights?.length > 0 && (
                <div className="bg-[var(--dg-tint)] p-3 rounded-xl space-y-1.5">
                  <span className="font-bold text-[var(--dg-gold)] block text-[12px]">
                    {tc('daygi.learnedBehavioralInsights')}
                  </span>
                  {/* learnedInsights is string[], not an object array. `ins.key`
                      and `ins.summaryEn` were undefined, so every insight
                      rendered as an empty bullet with a duplicate React key.
                      learnedInsightsAr holds the Arabic equivalents. */}
                  {(lang === 'ar' && userMemory.learnedInsightsAr?.length
                    ? userMemory.learnedInsightsAr
                    : userMemory.learnedInsights
                  ).map((insight, idx) => (
                    <div key={`insight-${idx}`} className="text-[var(--dg-text-2)] text-[12px] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--dg-teal)]" />
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              )}

            </div>

            <button
              onClick={() => setMemoryModalOpen(false)}
              className="w-full bg-[var(--dg-gold)] text-[var(--dg-gold-ink)] font-bold py-2 rounded-xl text-xs"
            >
              {tc('daygi.saveClose')}
            </button>
          </div>
        </div>
      )}

      {/* Book Now Modal for Direct Handoff */}
      {bookModalOpen && (
        <BookNowCommerceModal
          isOpen={bookModalOpen}
          onClose={() => setBookModalOpen(false)}
          // The prop is initialServiceId; `defaultSkuId` never existed on this
          // modal, so the DayGI handoff never preselected the service.
          initialServiceId={selectedSkuId}
          onBookingSuccess={(booking) => {
            setBookModalOpen(false);
            showToast(`تم تأكيد الحجز بنجاح (رقم ${booking.id}) ✨`);
          }}
        />
      )}

    </div>
  );
};

import { useMemo, useState } from 'react';
import {
  Waves,
  UtensilsCrossed,
  Coffee,
  Landmark,
  Info,
  X,
  Pin,
  PinOff,
  Trash2,
  MessageCircleQuestion,
  MapPin,
  Footprints,
  Scale,
  RefreshCw,
  CheckCircle2,
  Maximize2
} from 'lucide-react';
import type { DayGiCanvasDocument, DayGiCanvasItem } from '../../shared/types/daygi';
import { useConciergeT } from './useConciergeT';
import { DayGiCanvasMap } from './DayGiCanvasMap';

/**
 * The plan canvas: the structured document that sits beside the conversation
 * while the chat continues, mirroring what the traveler asked for — day tabs,
 * numbered option cards with price/blurb, and per-item actions (ask, pin,
 * remove, replace-by-asking). It is a pure view over the server-built
 * DayGiCanvasDocument; copy comes from the i18n catalog, never inline.
 */

const KIND_ICON: Record<DayGiCanvasItem['kind'], typeof Waves> = {
  ACTIVITY: Waves,
  FOOD: UtensilsCrossed,
  RELAX: Coffee,
  CULTURE: Landmark,
  NOTE: Info
};

export interface DayGiCanvasPanelProps {
  document: DayGiCanvasDocument;
  /** The concierge view carries an in-page language toggle; the canvas follows it. */
  lang: 'en' | 'ar';
  itemOverrides: Record<string, 'pinned' | 'removed'>;
  onTogglePin: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onAskAboutItem: (item: DayGiCanvasItem, replace: boolean) => void;
  /** Starts a follow-up turn asking for fresh alternatives to unpinned items. */
  onRegenerate: () => void;
  /** Books/holds an item that carries a commerce action (skuId + actionKey). */
  onExecuteItem: (item: DayGiCanvasItem) => void;
  onClose: () => void;
}

export function DayGiCanvasPanel({
  document,
  lang,
  itemOverrides,
  onTogglePin,
  onRemoveItem,
  onAskAboutItem,
  onRegenerate,
  onExecuteItem,
  onClose
}: DayGiCanvasPanelProps) {
  // Bound to the concierge's in-page language toggle (the `lang` prop), not
  // the site language — this panel renders inside a response whose language
  // the traveler chose on the concierge toggle.
  const t = useConciergeT(lang);
  const isRTL = lang === 'ar';
  const [activeDay, setActiveDay] = useState<string>('all');
  const [compareOn, setCompareOn] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  const visibleDays = useMemo(
    () => document.days.filter(day => activeDay === 'all' || day.id === activeDay),
    [document.days, activeDay]
  );

  /*
    Continuous numbering across the visible day groups (TripAdvisor numbers
    its plan cards 1..N across days, and the map pins must match the cards).
    Removed items keep their slot empty rather than renumbering the rest.
  */
  const itemNumbers = useMemo(() => {
    const numbers: Record<string, number> = {};
    let next = 0;
    for (const day of visibleDays) {
      for (const item of day.items) {
        numbers[item.id] = itemOverrides[item.id] === 'removed' ? -1 : next;
        if (itemOverrides[item.id] !== 'removed') next += 1;
      }
    }
    return numbers;
  }, [visibleDays, itemOverrides]);

  const mappableItems = useMemo(
    () =>
      visibleDays
        .flatMap(day => day.items)
        .filter(item => itemOverrides[item.id] !== 'removed' && item.spot),
    [visibleDays, itemOverrides]
  );

  /*
    Bookable experiences: the commerce-capable items (skuId + actionKey)
    gathered under their own heading, TripAdvisor-style. They keep their
    day-section cards too — the section is a booking shortcut, not a move —
    and numbering stays global so map pins and cards keep agreeing.
  */
  const bookableItems = useMemo(
    () =>
      visibleDays
        .flatMap(day => day.items)
        .filter(item => itemOverrides[item.id] !== 'removed' && item.kind !== 'NOTE' && item.actionKey && item.skuId),
    [visibleDays, itemOverrides]
  );

  const renderItem = (item: DayGiCanvasItem) => {
    const override = itemOverrides[item.id];
    if (override === 'removed') return null;
    const pinned = override === 'pinned';
    const index = itemNumbers[item.id] ?? 0;
    const Icon = KIND_ICON[item.kind] ?? Waves;
    const name = isRTL ? item.nameAr || item.name : item.name;
    const blurb = isRTL ? item.blurbAr || item.blurb : item.blurb;
  return (
      <article
        key={item.id}
        data-testid="daygi-canvas-item"
        data-pinned={pinned || undefined}
        className={`dg-focus rounded-2xl border bg-[var(--dg-panel)] p-3.5 transition-colors ${
          pinned ? 'border-[var(--dg-gold)]' : 'border-[var(--dg-line)]'
        }`}
      >
        <div className="flex items-start gap-2.5">
          <span
            className="w-6 h-6 rounded-full bg-[var(--dg-tint-2)] text-[var(--dg-text-2)] text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5"
            aria-hidden="true"
          >
            {index + 1}
          </span>
          {/*
            Real catalogue photo only: the server attaches imageUrl solely on
            a confident venue/stay match, so a missing image means "unknown",
            never a placeholder pretending to be the place.
          */}
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={name}
              loading="lazy"
              className="w-20 h-20 rounded-xl object-cover shrink-0 border border-[var(--dg-line)]"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-[var(--dg-text)] leading-snug break-words">
                <Icon className="w-3.5 h-3.5 inline-block align-[-2px] me-1.5 text-[var(--dg-teal)]" aria-hidden="true" />
                {name}
              </h4>
              {typeof item.priceEGP === 'number' && item.priceEGP > 0 && (
                <span className="shrink-0 text-xs text-[var(--dg-muted)]">
                  <span className="font-bold text-[var(--dg-text)]">
                    {t('daygi.canvasFromPrice', { price: item.priceEGP })}
                  </span>
                </span>
              )}
            </div>

            {typeof item.rating === 'number' && (
              <p
                className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--dg-text-2)]"
                aria-label={t('daygi.canvasRatingOf', { rating: item.rating.toFixed(1) })}
              >
                <span className="dg-num font-bold">{item.rating.toFixed(1)}</span>
                <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map(dot => (
                    <span
                      key={dot}
                      className={`w-2 h-2 rounded-full ${dot < Math.round(item.rating as number) ? 'bg-[var(--dg-gold)]' : 'bg-[var(--dg-line)]'}`}
                    />
                  ))}
                </span>
                {typeof item.reviewCount === 'number' && (
                  <span className="dg-num text-[var(--dg-muted)]">({item.reviewCount})</span>
                )}
              </p>
            )}

            {(item.time || item.location || item.travelTimeMins) && (
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--dg-muted)]">
                {item.time && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" aria-hidden="true" />
                    {item.time}
                  </span>
                )}
                {typeof item.travelTimeMins === 'number' && item.travelTimeMins > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Footprints className="w-3 h-3" aria-hidden="true" />
                    {t('daygi.canvasTravelTime', { mins: item.travelTimeMins })}
                  </span>
                )}
              </p>
            )}

            {blurb && (
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--dg-text-2)]">
                <mark className="bg-[var(--dg-tint)] text-[var(--dg-text)] rounded px-0.5">{blurb}</mark>
              </p>
            )}

            {item.kind !== 'NOTE' && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onAskAboutItem(item, false)}
                  className="dg-focus bg-[var(--dg-tint)] hover:bg-[var(--dg-tint-2)] text-[var(--dg-text-2)] hover:text-[var(--dg-text)] px-2.5 h-7 rounded-full text-[11px] transition-colors inline-flex items-center gap-1"
                >
                  <MessageCircleQuestion className="w-3 h-3" aria-hidden="true" />
                  {t('daygi.canvasAskAbout')}
                </button>
                <button
                  type="button"
                  onClick={() => onAskAboutItem(item, true)}
                  className="dg-focus bg-[var(--dg-tint)] hover:bg-[var(--dg-tint-2)] text-[var(--dg-text-2)] hover:text-[var(--dg-text)] px-2.5 h-7 rounded-full text-[11px] transition-colors"
                >
                  {t('daygi.canvasReplace')}
                </button>
                {item.actionKey && item.skuId && (
                  <button
                    type="button"
                    onClick={() => onExecuteItem(item)}
                    className="dg-focus bg-[var(--dg-ok)] hover:brightness-110 text-[var(--dg-text)] font-bold px-2.5 h-7 rounded-full text-[11px] transition-colors inline-flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    {t('daygi.canvasBook')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onTogglePin(item.id)}
                  aria-pressed={pinned}
                  className="dg-focus bg-[var(--dg-tint)] hover:bg-[var(--dg-tint-2)] text-[var(--dg-text-2)] hover:text-[var(--dg-text)] px-2.5 h-7 rounded-full text-[11px] transition-colors inline-flex items-center gap-1"
                >
                  {pinned ? <PinOff className="w-3 h-3" aria-hidden="true" /> : <Pin className="w-3 h-3" aria-hidden="true" />}
                  {pinned ? t('daygi.canvasUnpin') : t('daygi.canvasPin')}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  aria-label={`${t('daygi.canvasRemove')}: ${name}`}
                  className="dg-focus bg-[var(--dg-tint)] hover:bg-[var(--dg-tint-2)] text-[var(--dg-text-2)] hover:text-[var(--dg-text)] w-7 h-7 rounded-full transition-colors inline-flex items-center justify-center"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };

  /*
    Side-by-side comparison. Compares what the traveler pinned; with nothing
    pinned it compares everything currently visible, so the button always has
    something truthful to show instead of an empty table lecture.
  */
  const renderCompare = () => {
    const inView = visibleDays
      .flatMap(day => day.items)
      .filter(item => itemOverrides[item.id] !== 'removed' && item.kind !== 'NOTE');
    const pinned = inView.filter(item => itemOverrides[item.id] === 'pinned');
    const compared = pinned.length > 0 ? pinned : inView;
    if (compared.length === 0) return null;

    const cell = (item: DayGiCanvasItem, content: React.ReactNode, key: string) => (
      <div key={`${item.id}-${key}`} className="px-2.5 py-2 text-[11px] leading-relaxed text-[var(--dg-text-2)] break-words">
        {content}
      </div>
    );
    const priceOf = (item: DayGiCanvasItem) =>
      typeof item.priceEGP === 'number' && item.priceEGP > 0
        ? t('daygi.canvasFromPrice', { price: item.priceEGP })
        : '—';
    const travelOf = (item: DayGiCanvasItem) =>
      typeof item.travelTimeMins === 'number' && item.travelTimeMins > 0
        ? t('daygi.canvasTravelTime', { mins: item.travelTimeMins })
        : '—';

    return (
      <section data-testid="daygi-canvas-compare" className="dg-scroll overflow-x-auto pb-2">
        <div
          className="grid gap-px bg-[var(--dg-line)] rounded-xl overflow-hidden border border-[var(--dg-line)] min-w-0"
          style={{ gridTemplateColumns: `110px repeat(${compared.length}, minmax(120px, 1fr))` }}
        >
          <div className="bg-[var(--dg-panel)]" aria-hidden="true" />
          {compared.map(item => (
            <div key={`${item.id}-head`} className="bg-[var(--dg-panel)] px-2.5 py-2 text-xs font-bold text-[var(--dg-text)] break-words">
              <span className="dg-num text-[var(--dg-teal)] me-1">{(itemNumbers[item.id] ?? 0) + 1}.</span>
              {isRTL ? item.nameAr || item.name : item.name}
            </div>
          ))}

          <div className="bg-[var(--dg-tint)] px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--dg-muted)]">{t('daygi.canvasPrice')}</div>
          {compared.map(item => cell(item, priceOf(item), 'price'))}

          <div className="bg-[var(--dg-tint)] px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--dg-muted)]">{t('daygi.canvasLocation')}</div>
          {compared.map(item => cell(item, item.location || item.time || '—', 'loc'))}

          <div className="bg-[var(--dg-tint)] px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--dg-muted)]">{t('daygi.canvasTravel')}</div>
          {compared.map(item => cell(item, travelOf(item), 'travel'))}

          <div className="bg-[var(--dg-tint)] px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--dg-muted)]">{t('daygi.canvasWhy')}</div>
          {compared.map(item => cell(item, (isRTL ? item.blurbAr || item.blurb : item.blurb) || '—', 'why'))}
        </div>
        {pinned.length === 0 && (
          <p className="mt-2 text-[11px] text-[var(--dg-muted)] px-1">{t('daygi.canvasPinToCompare')}</p>
        )}
      </section>
    );
  };


  return (
    <div
      data-testid="daygi-canvas"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="dg-scroll flex-1 flex flex-col min-h-0 overflow-y-auto"
    >
      <div className="shrink-0 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--dg-teal)]">
              {t('daygi.canvasPlanLabel')}
            </p>
            <h3 className="text-sm font-semibold text-[var(--dg-text)] leading-snug break-words">
              {isRTL ? document.titleAr || document.title : document.title}
            </h3>
            {document.sourcePrompt && (
              <p className="text-[11px] text-[var(--dg-muted)] truncate">{document.sourcePrompt}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('daygi.canvasClose')}
            className="dg-focus w-8 h-8 rounded-lg flex items-center justify-center text-[var(--dg-muted)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-tint-2)] transition-colors shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div role="tablist" aria-label={t('daygi.canvasPlanLabel')} className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            role="tab"
            aria-selected={activeDay === 'all'}
            onClick={() => setActiveDay('all')}
            className={`dg-focus px-3 h-7 rounded-full text-[11px] font-semibold transition-colors ${
              activeDay === 'all'
                ? 'bg-[var(--dg-teal)] text-[var(--dg-gold-ink)]'
                : 'bg-[var(--dg-tint)] text-[var(--dg-text-2)] hover:text-[var(--dg-text)]'
            }`}
          >
            {t('daygi.canvasAllDays')}
          </button>
          {document.days.map(day => (
            <button
              key={day.id}
              type="button"
              role="tab"
              aria-selected={activeDay === day.id}
              onClick={() => setActiveDay(day.id)}
              className={`dg-focus px-3 h-7 rounded-full text-[11px] font-semibold transition-colors ${
                activeDay === day.id
                  ? 'bg-[var(--dg-teal)] text-[var(--dg-gold-ink)]'
                  : 'bg-[var(--dg-tint)] text-[var(--dg-text-2)] hover:text-[var(--dg-text)]'
              }`}
            >
              {isRTL ? day.labelAr || day.label : day.label}
            </button>
          ))}
        </div>

        {/*
          Plan-level actions: side-by-side comparison and regenerating fresh
          alternatives for whatever is not pinned. Both are local view state
          plus follow-up turns — the document itself is never rewritten.
        */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCompareOn(v => !v)}
            aria-pressed={compareOn}
            className={`dg-focus px-3 h-7 rounded-full text-[11px] font-semibold transition-colors inline-flex items-center gap-1.5 ${
              compareOn
                ? 'bg-[var(--dg-teal)] text-[var(--dg-gold-ink)]'
                : 'bg-[var(--dg-tint)] text-[var(--dg-text-2)] hover:text-[var(--dg-text)]'
            }`}
          >
            <Scale className="w-3 h-3" aria-hidden="true" />
            {compareOn ? t('daygi.canvasCompareHide') : t('daygi.canvasCompare')}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="dg-focus px-3 h-7 rounded-full text-[11px] font-semibold transition-colors inline-flex items-center gap-1.5 bg-[var(--dg-tint)] text-[var(--dg-text-2)] hover:text-[var(--dg-text)]"
          >
            <RefreshCw className="w-3 h-3" aria-hidden="true" />
            {t('daygi.canvasRegenerate')}
          </button>
        </div>
      </div>

        {mappableItems.length > 0 && (
          <div className="mt-3" data-testid="daygi-canvas-map-section">
            <div className="px-1 pb-1.5 flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--dg-muted)]">
                {t('daygi.canvasMapLabel')}
              </p>
              <button
                type="button"
                onClick={() => setMapExpanded(true)}
                aria-label={t('daygi.canvasExpandMap')}
                className="dg-focus h-7 px-2.5 rounded-full text-[11px] font-semibold bg-[var(--dg-tint)] text-[var(--dg-text-2)] hover:text-[var(--dg-text)] transition-colors inline-flex items-center gap-1.5"
              >
                <Maximize2 className="w-3 h-3" aria-hidden="true" />
                {t('daygi.canvasExpandMap')}
              </button>
            </div>
            <DayGiCanvasMap
              items={mappableItems}
              priceLabelFor={(item) => t('daygi.canvasFromPrice', { price: item.priceEGP ?? 0 })}
              onAskAboutItem={(item) => onAskAboutItem(item, false)}
            />
          </div>
        )}

      <div className="flex-1 min-h-0 space-y-2.5 pb-2">
        {compareOn ? renderCompare() : visibleDays.map(day => (
          <section key={day.id} data-testid="daygi-canvas-day">
            {(day.title || day.label) && (
              <div className="px-1 pb-1.5">
                <p className="text-[11px] font-bold text-[var(--dg-text-2)]">
                  {isRTL ? day.labelAr || day.label : day.label}
                </p>
                {(isRTL ? day.titleAr || day.title : day.title) && (
                  <p className="text-[11px] text-[var(--dg-muted)]">{isRTL ? day.titleAr || day.title : day.title}</p>
                )}
              </div>
            )}
            <div className="space-y-2.5">
              {day.items.map(item => renderItem(item))}
            </div>
          </section>
        ))}
        {/*
          Bookable experiences: every commerce-capable item in view, gathered
          under one booking shortcut. The day-section cards stay where they
          are — this section duplicates them as buyable entries, the same
          trade TripAdvisor's canvas makes.
        */}
        {!compareOn && bookableItems.length > 0 && (
          <section data-testid="daygi-canvas-bookable" className="pt-1">
            <div className="px-1 pb-1.5">
              <p className="text-[11px] font-bold text-[var(--dg-text-2)]">
                {t('daygi.canvasBookable')}
              </p>
              <p className="text-[11px] text-[var(--dg-muted)]">{t('daygi.canvasBookableSub')}</p>
            </div>
            <div className="space-y-2.5">
              {bookableItems.map(item => renderItem(item))}
            </div>
          </section>
        )}
      </div>

      {/*
        Expanded map dialog. Mounts a second map instance while open (Leaflet
        needs a visible container at creation, so it cannot reuse the inline
        one); both instances are destroyed with their containers.
      */}
      {mapExpanded && mappableItems.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-[var(--dg-scrim)] backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setMapExpanded(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('daygi.canvasMapDialog')}
            dir="ltr"
            className="daygi-surface w-full max-w-3xl h-[75vh] rounded-2xl border border-[var(--dg-line)] bg-[var(--dg-panel)] p-3 flex flex-col min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 pb-2 shrink-0">
              <p className="text-xs font-bold text-[var(--dg-text)]">{t('daygi.canvasMapDialog')}</p>
              <button
                type="button"
                onClick={() => setMapExpanded(false)}
                aria-label={t('daygi.canvasClose')}
                className="dg-focus w-8 h-8 rounded-lg flex items-center justify-center text-[var(--dg-muted)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-tint-2)] transition-colors shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 min-h-0 dg-scroll overflow-y-auto">
              <DayGiCanvasMap
                items={mappableItems}
                // Two-thirds of the viewport keeps the dialog map large on
                // desktop without overflowing phone sheets.
                height={Math.max(320, Math.round((typeof window !== 'undefined' ? window.innerHeight : 800) * 0.62))}
                priceLabelFor={(item) => t('daygi.canvasFromPrice', { price: item.priceEGP ?? 0 })}
                onAskAboutItem={(item) => onAskAboutItem(item, false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

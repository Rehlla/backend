import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ExternalLink, TrendingDown, TrendingUp, Star, Clock, Shield, ChevronDown, ChevronUp, Calendar, Info, Loader2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { fetchPriceComparison, type PriceQuote, type PriceComparisonResponse } from '../../services/priceComparison';

interface PriceComparisonProps {
  accommodationId: string;
  accommodationName: string;
  accommodationNameAr?: string;
  propertyType: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  rooms?: number;
  isDark?: boolean;
  onDatesChange?: (checkIn: string, checkOut: string) => void;
}

function calculateNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr: string, isArabic: boolean): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getTomorrow(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toJSON().split('T')[0];
}

function getMaxDate(): string {
  const max = new Date();
  max.setFullYear(max.getFullYear() + 1);
  return max.toJSON().split('T')[0];
}

export function PriceComparison({
  accommodationId,
  accommodationName,
  accommodationNameAr,
  propertyType,
  checkIn: initialCheckIn,
  checkOut: initialCheckOut,
  guests = 1,
  rooms = 1,
  isDark = false,
  onDatesChange,
}: PriceComparisonProps) {
  const { language, t } = useLanguage();
  const isArabic = language === 'ar';
  const [comparison, setComparison] = useState<PriceComparisonResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [checkIn, setCheckIn] = useState(initialCheckIn || getToday());
  const [checkOut, setCheckOut] = useState(initialCheckOut || getTomorrow());
  const [showDateHelp, setShowDateHelp] = useState(false);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const nights = calculateNights(checkIn, checkOut);

  const loadPrices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPriceComparison(
        {
          accommodationId,
          accommodationName,
          accommodationNameAr,
          checkIn,
          checkOut,
          guests,
          rooms,
        },
        propertyType
      );
      setComparison(result);
      // Announce to screen readers
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = t('priceComparison.loaded', {
          count: result.quotes.length.toString(),
          cheapest: result.cheapestQuote?.price.toLocaleString() || '0',
        });
      }
    } catch (err) {
      setError(t('priceComparison.error'));
    } finally {
      setLoading(false);
    }
  }, [accommodationId, accommodationName, accommodationNameAr, checkIn, checkOut, guests, rooms, propertyType, t]);

  useEffect(() => {
    loadPrices();
  }, [loadPrices]);

  const handleCheckInChange = (value: string) => {
    setCheckIn(value);
    if (new Date(value) >= new Date(checkOut)) {
      const nextDay = new Date(value);
      nextDay.setDate(nextDay.getDate() + 1);
      setCheckOut(nextDay.toJSON().split('T')[0]);
    }
    onDatesChange?.(value, checkOut);
  };

  const handleCheckOutChange = (value: string) => {
    setCheckOut(value);
    onDatesChange?.(checkIn, value);
  };

  if (loading) {
    return (
      <div className="animate-in fade-in duration-300">
        {/* Skeleton Loading */}
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-[var(--surface-card)] border-white/10' : 'bg-white border-gray-200'}`}>
          {/* Header skeleton */}
          <div className={`flex items-center justify-between px-4 py-3 ${isDark ? 'bg-[var(--surface-container)]' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gray-200 animate-pulse" />
              <div className="w-32 h-4 rounded bg-gray-200 animate-pulse" />
            </div>
            <div className="w-16 h-5 rounded-full bg-gray-200 animate-pulse" />
          </div>

          {/* Date picker skeleton */}
          <div className={`px-4 py-3 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
            <div className="flex gap-3">
              <div className="flex-1 h-12 rounded-lg bg-gray-100 animate-pulse" />
              <div className="flex-1 h-12 rounded-lg bg-gray-100 animate-pulse" />
            </div>
          </div>

          {/* Best price skeleton */}
          <div className={`px-4 py-4 ${isDark ? 'bg-emerald-900/20' : 'bg-emerald-50'}`}>
            <div className="w-20 h-5 rounded bg-emerald-200 animate-pulse mb-2" />
            <div className="w-40 h-8 rounded bg-emerald-200 animate-pulse mb-3" />
            <div className="w-32 h-10 rounded-lg bg-emerald-200 animate-pulse" />
          </div>

          {/* Quote cards skeleton */}
          <div className="p-3 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`rounded-lg border p-3 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-gray-200 animate-pulse" />
                    <div className="w-20 h-4 rounded bg-gray-200 animate-pulse" />
                  </div>
                  <div className="w-16 h-3 rounded bg-gray-200 animate-pulse" />
                </div>
                <div className="flex justify-between mb-3">
                  <div className="w-24 h-6 rounded bg-gray-200 animate-pulse" />
                  <div className="w-16 h-6 rounded bg-gray-200 animate-pulse" />
                </div>
                <div className="w-full h-10 rounded-lg bg-gray-200 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center animate-in fade-in duration-200">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
          <Info size={24} className="text-red-500" />
        </div>
        <span className="text-sm text-red-500 font-medium">{error}</span>
        <button
          onClick={loadPrices}
          className="inline-flex items-center gap-2 bg-blue-500 text-white border-none px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-blue-600 transition-colors"
          aria-label={t('priceComparison.retry')}
        >
          <Loader2 size={14} className="animate-spin" />
          {t('priceComparison.retry')}
        </button>
      </div>
    );
  }

  if (!comparison || comparison.quotes.length === 0) {
    return null;
  }

  const { quotes, cheapestQuote, averagePrice } = comparison;
  const displayedQuotes = expanded ? quotes : quotes.slice(0, 3);
  const savings = averagePrice - (cheapestQuote?.price || 0);
  const savingsPercent = averagePrice > 0 ? Math.round((savings / averagePrice) * 100) : 0;

  return (
    <div className={`rounded-xl border overflow-hidden animate-in fade-in duration-300 ${isDark ? 'bg-[var(--surface-card)] border-white/10' : 'bg-white border-gray-200'}`}>
      {/* Screen reader live region */}
      <div ref={liveRegionRef} aria-live="polite" aria-atomic="true" className="sr-only" />

      {/* Date Picker */}
      <div className={`px-4 py-3 border-b ${isDark ? 'bg-[var(--surface-container)] border-white/10' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-blue-500" />
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {t('priceComparison.selectDates')}
            </span>
          </div>
          <button
            onClick={() => setShowDateHelp(!showDateHelp)}
            className="p-1 rounded-full hover:bg-gray-200 transition-colors"
            aria-label={t('priceComparison.dateHelp')}
            aria-expanded={showDateHelp}
          >
            <Info size={14} className="text-gray-400" />
          </button>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="checkin-date" className="sr-only">
              {t('priceComparison.checkIn')}
            </label>
            <input
              type="date"
              id="checkin-date"
              value={checkIn}
              min={getToday()}
              max={getMaxDate()}
              onChange={(e) => handleCheckInChange(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-[var(--surface-card)] border-white/20 text-[var(--text-primary)] focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/30`}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="checkout-date" className="sr-only">
              {t('priceComparison.checkOut')}
            </label>
            <input
              type="date"
              id="checkout-date"
              value={checkOut}
              min={checkIn}
              max={getMaxDate()}
              onChange={(e) => handleCheckOutChange(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-[var(--surface-card)] border-white/20 text-[var(--text-primary)] focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/30`}
            />
          </div>
        </div>

        {/* Nights count */}
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">
            {nights} {nights === 1 ? t('priceComparison.night') : t('priceComparison.nights')}
          </span>
          <span className="text-[var(--text-secondary)]">
            {formatDate(checkIn, isArabic)} — {formatDate(checkOut, isArabic)}
          </span>
        </div>

        {/* Date help tooltip */}
        {showDateHelp && (
          <div className={`mt-2 p-3 rounded-lg text-xs ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
            {t('priceComparison.dateHelpText')}
          </div>
        )}
      </div>

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 ${isDark ? 'border-b border-white/10' : 'border-b border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <TrendingDown size={20} className="text-emerald-500" aria-hidden="true" />
          <span className="font-semibold text-sm text-[var(--text-primary)]">
            {t('priceComparison.title')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {comparison.source === 'live' && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              {t('priceComparison.livePrices')}
            </span>
          )}
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isDark ? 'bg-white/10 text-[var(--text-secondary)]' : 'bg-gray-200 text-gray-600'}`}>
            {quotes.length} {t('priceComparison.platforms')}
          </span>
        </div>
      </div>

      {/* Cheapest Quote Highlight */}
      {cheapestQuote && (
        <div className={`px-4 py-4 ${isDark ? 'bg-emerald-900/20 border-b border-emerald-500/30' : 'bg-emerald-50 border-b border-emerald-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="inline-flex items-center gap-1 bg-emerald-500 text-white px-2.5 py-1 rounded-full text-xs font-semibold">
              <Shield size={14} aria-hidden="true" />
              <span>{t('priceComparison.bestPrice')}</span>
            </div>
            {savingsPercent > 0 && (
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-semibold">
                <TrendingDown size={12} aria-hidden="true" />
                {t('priceComparison.save')} {savingsPercent}%
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-black text-emerald-600">
              EGP {cheapestQuote.price.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500">
              ({t('priceComparison.perNight')}: EGP {cheapestQuote.perNight.toLocaleString()})
            </span>
          </div>

          {nights > 1 && (
            <p className="text-xs text-gray-500 mb-3">
              {t('priceComparison.totalFor')} {nights} {nights === 1 ? t('priceComparison.night') : t('priceComparison.nights')}
            </p>
          )}

          <a
            href={cheapestQuote.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-emerald-500 text-white px-5 py-3 rounded-xl text-sm font-bold no-underline hover:bg-emerald-600 transition-all hover:shadow-lg active:scale-[0.98]"
            aria-label={`${t('priceComparison.bookNow')} ${t('priceComparison.on')} ${cheapestQuote.platform}`}
          >
            {t('priceComparison.bookNow')}
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>
      )}

      {/* All Quotes */}
      <div className="p-3 flex flex-col gap-3">
        {displayedQuotes.map((quote) => (
          <QuoteCard
            key={quote.platform}
            quote={quote}
            isArabic={isArabic}
            isDark={isDark}
            cheapestPrice={cheapestQuote?.price || 0}
            nights={nights}
          />
        ))}
      </div>

      {/* Show More/Less */}
      {quotes.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center justify-center gap-2 w-full py-3.5 text-sm font-semibold cursor-pointer border-none transition-colors ${
            isDark ? 'bg-[var(--surface-container)] text-blue-400 hover:bg-blue-900/30' : 'bg-gray-50 text-blue-500 hover:bg-gray-100'
          }`}
          aria-expanded={expanded}
          aria-label={expanded ? t('priceComparison.showLess') : t('priceComparison.showMore', { count: quotes.length.toString() })}
        >
          {expanded ? (
            <>
              <ChevronUp size={18} aria-hidden="true" />
              {t('priceComparison.showLess')}
            </>
          ) : (
            <>
              <ChevronDown size={18} aria-hidden="true" />
              {t('priceComparison.showMore', { count: quotes.length.toString() })}
            </>
          )}
        </button>
      )}

      {/* Average Price */}
      <div className={`px-4 py-3 text-center text-xs ${isDark ? 'bg-[var(--surface-container)] border-t border-white/10 text-[var(--text-secondary)]' : 'bg-gray-50 border-t border-gray-200 text-gray-500'}`}>
        {t('priceComparison.averagePrice')}: EGP {averagePrice.toLocaleString()}
      </div>

      {/* Footer Note */}
      <div className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] ${isDark ? 'bg-[var(--surface-container)] border-t border-white/10 text-[var(--text-secondary)]' : 'bg-gray-50 border-t border-gray-200 text-gray-400'}`}>
        <Clock size={12} aria-hidden="true" />
        <span>
          {t('priceComparison.lastUpdated')}: {new Date(comparison.lastUpdated).toLocaleTimeString(isArabic ? 'ar-EG' : 'en-US')}
        </span>
      </div>
    </div>
  );
}

interface QuoteCardProps {
  quote: PriceQuote;
  isArabic: boolean;
  isDark: boolean;
  cheapestPrice: number;
  nights: number;
}

function QuoteCard({ quote, isArabic, isDark, cheapestPrice, nights }: QuoteCardProps) {
  const savings = quote.price - cheapestPrice;
  const savingsPercent = cheapestPrice > 0 ? Math.round((savings / cheapestPrice) * 100) : 0;

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        quote.isLowest
          ? isDark
            ? 'border-emerald-500/50 bg-emerald-900/10'
            : 'border-emerald-300 bg-emerald-50/50'
          : isDark
          ? 'border-white/10 hover:border-white/20'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      role="article"
      aria-label={`${quote.platform} - EGP ${quote.price.toLocaleString()}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <img
            src={quote.platformLogo}
            alt=""
            className="w-7 h-7 object-contain"
            aria-hidden="true"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div>
            <span className="font-semibold text-sm text-[var(--text-primary)]">{quote.platform}</span>
            {quote.isLowest && (
              <span className="ml-2 inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                <Shield size={10} aria-hidden="true" />
                {isArabic ? 'الأقل' : 'Lowest'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500" aria-label={`${quote.rating?.toFixed(1)} stars, ${quote.reviewCount} reviews`}>
          <Star size={14} fill="currentColor" className="text-[var(--text-primary)]" aria-hidden="true" />
          <span className="font-medium">{quote.rating?.toFixed(1)}</span>
          <span className="text-gray-400">({quote.reviewCount.toLocaleString()})</span>
        </div>
      </div>

      {/* Price Breakdown */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--text-secondary)]">{isArabic ? 'السعر الإجمالي' : 'Total Price'}</span>
            <span className="font-bold text-[var(--text-primary)]">EGP {quote.totalPrice.toLocaleString()}</span>
          </div>
          {quote.fees && quote.fees > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{isArabic ? 'رسوم' : 'Fees'}</span>
              <span>EGP {quote.fees.toLocaleString()}</span>
            </div>
          )}
          {quote.taxes && quote.taxes > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{isArabic ? 'ضرائب' : 'Taxes'}</span>
              <span>EGP {quote.taxes.toLocaleString()}</span>
            </div>
          )}
          {nights > 1 && (
            <div className="text-xs text-gray-400 mt-1">
              {nights} × EGP {quote.perNight.toLocaleString()}
            </div>
          )}
        </div>

        <div className="text-right">
          <span className="block text-lg font-black text-[var(--text-primary)]">
            EGP {quote.perNight.toLocaleString()}
          </span>
          <span className="text-xs text-gray-500">{isArabic ? '/ ليلة' : '/night'}</span>
          {savingsPercent > 0 && !quote.isLowest && (
            <span className="block text-[10px] text-red-500 mt-1">
              +{savingsPercent}% {isArabic ? 'أكثر' : 'more'}
            </span>
          )}
        </div>
      </div>

      {/* Book Button */}
      <a
        href={quote.affiliateUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold no-underline transition-all ${
          quote.isLowest
            ? 'bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-lg'
            : 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg'
        } active:scale-[0.98]`}
        aria-label={`${isArabic ? 'احجز على' : 'Book on'} ${quote.platform}`}
      >
        {isArabic ? 'احجز على' : 'Book on'} {quote.platform}
        <ExternalLink size={14} aria-hidden="true" />
      </a>
    </div>
  );
}

export default PriceComparison;

import React from 'react';
import { 
  Clock, 
  MapPin, 
  Sparkles, 
  Waves, 
  Coffee, 
  Utensils, 
  Compass, 
  Car, 
  Hotel, 
  RefreshCw, 
  ChevronRight, 
  Sun, 
  Moon, 
  Tag, 
  Info,
  Calendar
} from 'lucide-react';
import { ActivityDetailData } from './ActivityDetailModal';
import { useLanguage } from '../../i18n/LanguageContext';

export type ActivityStatus = 'suggested' | 'free_time' | 'booked';

export interface ItineraryItem {
  id: string;
  time: string;
  name: string;
  description?: string;
  location?: string;
  category: string;
  status: ActivityStatus;
  isHighlight?: boolean;
  hasAlternatives?: boolean;
  alternativeCount?: number;
  alternativeName?: string;
  image?: string;
  details?: {
    fullDetails: string;
    included: string[];
    tips: string;
  };
}

export interface DayItinerary {
  dayNumber: number;
  title: string;
  theme: string;
  badge?: string;
  summary: string;
  items: ItineraryItem[];
}

interface ItineraryDayCardProps {
  day: DayItinerary;
  onOpenActivityDetails: (data: ActivityDetailData) => void;
  onOpenAlternatives: (activityTitle: string, currentId: string) => void;
}

export const ItineraryDayCard: React.FC<ItineraryDayCardProps> = ({
  day,
  onOpenActivityDetails,
  onOpenAlternatives,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const getCategoryIcon = (category: string, status: ActivityStatus) => {
    if (status === 'free_time') {
      return <Sun className="w-3.5 h-3.5 text-amber-400" />;
    }
    switch (category.toLowerCase()) {
      case 'diving':
      case 'water activities':
      case 'water & boat':
        return <Waves className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />;
      case 'food':
      case 'dining':
        return <Utensils className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />;
      case 'coffee':
      case 'cafe':
        return <Coffee className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />;
      case 'adventure':
      case 'desert & safari':
      case 'safari':
        return <Compass className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />;
      case 'transfer':
      case 'logistics':
        return <Car className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />;
      case 'stay':
      case 'hotel':
        return <Hotel className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />;
      default:
        return <Compass className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />;
    }
  };

  return (
    <div 
      id={`itinerary-day-${day.dayNumber}`}
      dir={isRTL ? 'rtl' : 'ltr'}
      className="bg-[var(--surface-card)] rounded-3xl border border-[var(--border-subtle)] shadow-xs overflow-hidden transition-[background-color,border-color,color,box-shadow,transform,opacity] mb-8 text-[var(--text-primary)]"
    >
      {/* Day Card Header */}
      <div className="p-6 sm:p-7 border-b border-[var(--border-subtle)] bg-[var(--surface-container)]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[var(--accent-secondary)] text-[var(--surface-card)] flex flex-col items-center justify-center font-bold flex-shrink-0 shadow-xs">
            <span className="text-[11px] leading-none text-[var(--surface-card)]/80 font-black">
              {isAr ? 'يوم' : 'DAY'}
            </span>
            <span className="text-base chart-heading font-black leading-none mt-0.5">{day.dayNumber}</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl sm:text-2xl chart-heading font-bold text-[var(--text-primary)] tracking-tight">
                {day.title}
              </h3>
              {day.badge && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/25">
                  {day.badge}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]/70 mt-0.5 font-normal">
              {day.summary}
            </p>
          </div>
        </div>

        <div className="text-xs font-semibold text-[var(--accent-secondary)] flex items-center gap-1.5 self-start sm:self-center bg-[var(--surface-container)] px-3 py-1.5 rounded-full border border-[var(--border-subtle)]">
          <Calendar className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
          <span>{day.theme}</span>
        </div>
      </div>

      {/* Vertical Timeline Activity List */}
      <div className="p-6 sm:p-8">
        <div className={`relative ${isRTL ? 'pr-6 sm:pr-8' : 'pl-6 sm:pl-8'} space-y-6 before:content-[''] before:absolute ${isRTL ? 'before:right-2 sm:before:right-3' : 'before:left-2 sm:before:left-3'} before:top-3 before:bottom-3 before:w-0.5 before:bg-[var(--btn-util-bg)]`}>
          {day.items.map((item, idx) => {
            const isFreeTime = item.status === 'free_time';

            return (
              <div 
                key={item.id || idx}
                id={`timeline-item-${day.dayNumber}-${idx}`}
                className="relative group"
              >
                {/* Timeline Dot Node */}
                <div 
                  className={`absolute ${isRTL ? '-right-6 sm:-right-8' : '-left-6 sm:-left-8'} top-1.5 w-4 h-4 rounded-full border-2 transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center ${
                    item.isHighlight
                      ? 'bg-[var(--accent-secondary)] border-[var(--surface-card)] ring-2 ring-[var(--accent-secondary)] shadow-2xs'
                      : isFreeTime
                      ? 'bg-amber-400 border-amber-600'
                      : 'bg-[var(--surface-container)] border-[var(--accent-secondary)]'
                  }`}
                >
                  {item.isHighlight && <span className="w-1.5 h-1.5 rounded-full bg-[var(--surface-card)]" />}
                </div>

                {/* Activity Box Container */}
                <div 
                  className={`p-4 sm:p-5 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                    item.isHighlight
                      ? 'bg-gradient-to-r from-[var(--accent-secondary)]/10 via-[var(--surface-container)] to-[var(--surface-container)] border-[var(--accent-secondary)]/30 shadow-2xs'
                      : isFreeTime
                      ? 'bg-amber-950/20 border-amber-500/20'
                      : 'bg-[var(--surface-container)]/70 hover:bg-[var(--surface-container)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Time & Title Info */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        {/* Time Label */}
                        <div className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-card)]/80 px-2.5 py-0.5 rounded-full border border-[var(--border-subtle)] shadow-2xs">
                          <Clock className="w-3 h-3 text-[var(--accent-secondary)]" />
                          <span>{item.time}</span>
                        </div>

                        {/* Category Pill */}
                        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--text-secondary)]/70 px-2 py-0.5 rounded-full bg-[var(--btn-util-bg)] border border-[var(--border-subtle)]">
                          {getCategoryIcon(item.category, item.status)}
                          <span>{item.category}</span>
                        </span>

                        {/* Status Label: Suggested vs Free Time */}
                        <span 
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            isFreeTime
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-[var(--btn-util-bg)] text-[var(--text-secondary)]/60 border border-[var(--border-subtle)]'
                          }`}
                        >
                          {isFreeTime ? (isAr ? 'وقت حر ومسترخي' : 'Free Time') : (isAr ? 'مقترح' : 'Suggested')}
                        </span>

                        {/* Highlight Badge */}
                        {item.isHighlight && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--accent-secondary)] text-[var(--surface-card)] shadow-2xs">
                            <Sparkles className="w-2.5 h-2.5 text-[var(--surface-card)]" />
                            <span>{isAr ? 'تجربة مميزة' : 'Highlight'}</span>
                          </span>
                        )}
                      </div>

                      {/* Activity Name */}
                      <h4 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight mt-1">
                        {item.name}
                      </h4>

                      {/* Short Description */}
                      {item.description && (
                        <p className="text-xs sm:text-sm text-[var(--text-secondary)]/80 mt-1 leading-relaxed font-normal">
                          {item.description}
                        </p>
                      )}

                      {/* Location reference if present */}
                      {item.location && (
                        <div className="flex items-center gap-1.5 text-xs text-[var(--accent-secondary)] font-medium mt-2">
                          <MapPin className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                          <span>{item.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Interactive Action Controls */}
                    <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-2 pt-1">
                      {/* View Details Action */}
                      {item.details && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenActivityDetails({
                              time: item.time,
                              dayNumber: day.dayNumber,
                              dayTitle: day.title,
                              name: item.name,
                              location: item.location || 'Dahab, South Sinai',
                              category: item.category,
                              description: item.description || '',
                              fullDetails: item.details?.fullDetails || '',
                              included: item.details?.included || [],
                              tips: item.details?.tips || '',
                              image: item.image,
                              isHighlight: item.isHighlight,
                            })
                          }
                          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-primary)] hover:text-[var(--text-primary)] bg-[var(--surface-card)]/80 hover:bg-[var(--surface-card)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                        >
                          <span>{isAr ? 'عرض التفاصيل' : 'View details'}</span>
                          <ChevronRight className={`w-3 h-3 text-[var(--accent-secondary)] ${isRTL ? 'rotate-180' : ''}`} />
                        </button>
                      )}

                      {/* See Alternatives Option */}
                      {item.hasAlternatives && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenAlternatives(
                              item.name,
                              item.alternativeName || 'canyon-4x4'
                            )
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-full transition-colors cursor-pointer shadow-2xs"
                        >
                          <RefreshCw className="w-3 h-3 text-[var(--accent-secondary)]" />
                          <span>{isAr ? `تصفح ${item.alternativeCount || 3} بدائل` : `See ${item.alternativeCount || 3} alternatives`}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};


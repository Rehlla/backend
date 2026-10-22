import React from 'react';
import { X, Check, MapPin, Clock, Compass, ShieldCheck, Sparkles, Tag } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export interface ActivityDetailData {
  time: string;
  dayNumber: number;
  dayTitle: string;
  name: string;
  location: string;
  category: string;
  description: string;
  fullDetails: string;
  included: string[];
  tips: string;
  image?: string;
  isHighlight?: boolean;
}

interface ActivityDetailModalProps {
  activity: ActivityDetailData | null;
  onClose: () => void;
}

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  activity,
  onClose,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  if (!activity) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div 
        className="bg-[var(--surface-card)] text-[var(--text-primary)] rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-[var(--border-subtle)] shadow-2xl overflow-hidden relative"
        role="dialog"
        aria-modal="true"
        aria-label={activity.name}
      >
        {/* Banner Image */}
        {activity.image && (
          <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-black/40">
            <img
              src={activity.image}
              alt={activity.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-card)] via-black/30 to-transparent" />
            
            <button
              type="button"
              onClick={onClose}
              aria-label={isAr ? 'إغلاق تفاصيل النشاط' : 'Close detail modal'}
              className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer border border-[var(--border-subtle)]`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="absolute bottom-3.5 left-4 right-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                {activity.isHighlight && (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--accent-secondary)] text-[var(--surface-card)] text-[11px] font-bold">
                    {isAr ? 'تجربة مميزة' : 'Highlight'}
                  </span>
                )}
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  {isAr ? `اليوم ${activity.dayNumber} · ${activity.time}` : `Day ${activity.dayNumber} · ${activity.time}`}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl chart-heading font-bold text-[var(--text-primary)] leading-tight">
                {activity.name}
              </h3>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 sm:p-8">
          {!activity.image && (
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)] mb-4">
              <div>
                <span className="text-xs font-bold text-[var(--accent-secondary)] block">
                  {isAr ? `اليوم ${activity.dayNumber} · ${activity.time}` : `Day ${activity.dayNumber} · ${activity.time}`}
                </span>
                <h3 className="text-xl chart-heading font-bold text-[var(--text-primary)]">
                  {activity.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={isAr ? 'إغلاق تفاصيل النشاط' : 'Close detail modal'}
                className="w-8 h-8 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] flex items-center justify-center text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quick Details Badges */}
          <div className="flex flex-wrap items-center gap-3 py-3 border-b border-[var(--border-subtle)] mb-4 text-xs">
            <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <MapPin className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              <span className="font-semibold">{activity.location}</span>
            </div>
            <span className="text-[var(--text-muted)]">·</span>
            <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <Tag className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              <span>{activity.category}</span>
            </div>
          </div>

          {/* Detailed Paragraph */}
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]/90 leading-relaxed mb-5 font-normal">
            {activity.fullDetails || activity.description}
          </p>

          {/* What's Included */}
          {activity.included && activity.included.length > 0 && (
            <div className="mb-5 p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)]">
              <h4 className="text-xs font-bold text-[var(--accent-secondary)] mb-2.5 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                <span>{isAr ? 'ما يشمله النشاط' : "What's Included"}</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                {activity.included.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-secondary)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Local Tip */}
          {activity.tips && (
            <div className="p-3.5 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[var(--accent-secondary)] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-[var(--text-primary)] font-semibold">{isAr ? 'نصيحة أهل دهب:' : 'Local Dahab Tip:'}</strong>{' '}
                {activity.tips}
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-full bg-[var(--accent-secondary)] hover:bg-amber-300 text-[var(--surface-card)] text-xs font-bold cursor-pointer transition-colors"
            >
              {isAr ? 'إغلاق' : 'Close Details'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


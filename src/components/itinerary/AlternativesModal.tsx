import React from 'react';
import { X, Check, ArrowRight, Sparkles, RefreshCw, Compass } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { IMG_P1469854523086cc02fe5d8800_800, IMG_P1509316975850ff9c5deb0cd9_CARD, IMG_P15103123056538ed496efae75_CARD, IMG_P154455176346a013bb70d5_CARD } from '../../shared/placeholderImagery';

export interface AlternativeItem {
  id: string;
  title: string;
  titleAr: string;
  duration: string;
  durationAr: string;
  description: string;
  descriptionAr: string;
  image: string;
  tag: string;
  tagAr: string;
  recommendedFor: string;
  recommendedForAr: string;
}

interface AlternativesModalProps {
  isOpen: boolean;
  activityTitle: string;
  currentAlternativeId: string;
  onSelectAlternative: (alt: AlternativeItem) => void;
  onClose: () => void;
}

export const ALTERNATIVES_LIST: AlternativeItem[] = [
  {
    id: 'canyon-4x4',
    title: 'Colored Canyon & White Canyon 4x4 Safari',
    titleAr: 'سفاري وادي الكانيون الملون والأبيض بالدفع الرباعي',
    duration: '4–5 hours',
    durationAr: '٤–٥ ساعات',
    description: 'Traverse narrow red sandstone canyons with local Bedouin guides and tea in the desert.',
    descriptionAr: 'تجول بين ممرات الحجر الرملي الوردي مع أدلاء بدو سيناء وشاي جبلي في الصحراء.',
    image: IMG_P1509316975850ff9c5deb0cd9_CARD,
    tag: 'Currently Selected',
    tagAr: 'المحدد حالياً',
    recommendedFor: 'Geology & hiking enthusiasts',
    recommendedForAr: 'عشاق الطبيعة الجيولوجية والهايكنج',
  },
  {
    id: 'wadi-gnai',
    title: 'Wadi Gnai Climbing & Palm Oasis Trek',
    titleAr: 'تسلق صخور وادي قني ومسار واحة النخيل',
    duration: '3.5 hours',
    durationAr: '٣.٥ ساعات',
    description: 'Explore the granite valley of Wadi Gnai, hike past freshwater springs, and climb desert boulders.',
    descriptionAr: 'استكشف الوادي الجرانيتي المهيب في وادي قني مع عيون المياه العذبة وتسلق الصخور الطبيعية.',
    image: IMG_P1469854523086cc02fe5d8800_800,
    tag: 'Active Alternative',
    tagAr: 'بديل نشط ومغامر',
    recommendedFor: 'Hikers & climbing enthusiasts',
    recommendedForAr: 'هواة المشي الجبلي والتسلق',
  },
  {
    id: 'ras-abu-galum-camel',
    title: 'Ras Abu Galum Camel Trek & Bedouin Coast',
    titleAr: 'رحلة الجمال إلى رأس أبو جالوم والساحل البدوي',
    duration: '4 hours',
    durationAr: '٤ ساعات',
    description: 'Ride along the dramatic coastline cliffs between the Blue Hole and the quiet Bedouin settlement.',
    descriptionAr: 'مسار ساحلي ملحمي على ظهور الجمال بين البلو هول ومحمية رأس أبو جالوم البدوية الهادئة.',
    image: IMG_P154455176346a013bb70d5_CARD,
    tag: 'Scenic Coast Alternative',
    tagAr: 'بديل ساحلي بانورامي',
    recommendedFor: 'Coastal views & cultural pace',
    recommendedForAr: 'عشاق الإطلالات الساحلية والأجواء الهادئة',
  },
  {
    id: 'stargazing-dinner',
    title: 'Sunset Mountain Stargazing & Bedouin Camp',
    titleAr: 'غروب الجبل ورصد النجوم مع عشاء في المخيم البدوي',
    duration: '5 hours',
    durationAr: '٥ ساعات',
    description: 'Climb to a high ridge for panoramic sunset views followed by telescope stargazing & fresh campfire dinner.',
    descriptionAr: 'صعود لقمة جبلية لمشاهدة الغروب يعقبه رصد المجرات بالتلسكوب وعشاء طازج حول موقد النار.',
    image: IMG_P15103123056538ed496efae75_CARD,
    tag: 'Evening Alternative',
    tagAr: 'بديل مسائي ساحر',
    recommendedFor: 'Night skies & relaxed dinner',
    recommendedForAr: 'عشاق سماء الليل والعشاء الهادئ',
  },
];

export const AlternativesModal: React.FC<AlternativesModalProps> = ({
  isOpen,
  activityTitle,
  currentAlternativeId,
  onSelectAlternative,
  onClose,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div 
        className="bg-[var(--surface-card)] text-[var(--text-primary)] rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-[var(--border-subtle)] shadow-2xl p-6 sm:p-8 relative"
        role="dialog"
        aria-modal="true"
        aria-label={isAr ? 'استكشاف البدائل' : 'Explore Alternatives'}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)] mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[var(--accent-secondary)]/15 flex items-center justify-center text-[var(--accent-secondary)]">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xl chart-heading font-bold text-[var(--text-primary)]">
                {isAr ? 'استكشف البدائل المتاحة' : 'Explore Alternatives'}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]/70 font-normal">
                {isAr ? `اختر تجربة بديلة لنشاط "${activityTitle}"` : `Choose an alternative experience for ${activityTitle}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق نافذة البدائل' : 'Close alternatives modal'}
            className="w-8 h-8 rounded-full bg-[var(--surface-card)]/10 hover:bg-[var(--surface-card)]/15 flex items-center justify-center text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alternatives List */}
        <div className="space-y-4 mb-6">
          {ALTERNATIVES_LIST.map((item) => {
            const isCurrent = currentAlternativeId === item.id;
            const title = isAr ? item.titleAr : item.title;
            const desc = isAr ? item.descriptionAr : item.description;
            const duration = isAr ? item.durationAr : item.duration;
            const recommended = isAr ? item.recommendedForAr : item.recommendedFor;

            return (
              <div
                key={item.id}
                onClick={() => {
                  onSelectAlternative(item);
                  onClose();
                }}
                className={`p-4 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between ${
                  isCurrent
                    ? 'bg-[var(--surface-container)] border-[var(--accent-secondary)] ring-1 ring-[var(--accent-secondary)]/40'
                    : 'bg-[var(--surface-container)]/60 hover:bg-[var(--surface-container)] border-[var(--border-subtle)] hover:border-[var(--accent-secondary)]/40'
                }`}
              >
                <div className="flex items-center gap-3.5 flex-1">
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-black/40 relative">
                    <img
                      src={item.image}
                      alt={title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text-primary)] leading-tight">
                        {title}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--accent-secondary)] text-[var(--surface-container)] text-[11px] font-bold">
                          {isAr ? 'النشاط الحالي' : 'Active'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]/70 mt-1 leading-snug font-normal">
                      {desc}
                    </p>
                    <span className="text-[12px] text-[var(--accent-secondary)] font-semibold mt-1 block">
                      {duration} · {recommended}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap self-end sm:self-center ${
                    isCurrent
                      ? 'bg-[var(--accent-secondary)] text-[var(--surface-container)]'
                      : 'bg-[var(--surface-card)]/10 border border-white/15 text-[var(--text-primary)] hover:bg-[var(--surface-card)]/20'
                  }`}
                >
                  {isCurrent ? (isAr ? 'محدد حالياً' : 'Selected') : (isAr ? 'استبدل بهذا النشاط' : 'Swap to this')}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full bg-[var(--accent-secondary)] hover:bg-amber-300 text-[var(--surface-container)] text-xs font-bold transition-colors cursor-pointer"
          >
            {isAr ? 'تم' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};


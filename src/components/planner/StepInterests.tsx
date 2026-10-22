import React from 'react';
import { Sparkles, Check, ArrowRight, ArrowLeft, Compass, Info } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { IMG_P1469854523086cc02fe5d8800_800, IMG_P1507525428034b723cf961d3e_CARD, IMG_P1509316975850ff9c5deb0cd9_CARD, IMG_P15103123056538ed496efae75_CARD, IMG_P1526778548025fa2f459cd5c1_800, IMG_P154455176346a013bb70d5_CARD, IMG_P1555396273367ea4eb4db5_800, IMG_P16826872200634742bd7fd538_CARD } from '../../shared/placeholderImagery';

export type InterestId =
  | 'diving'
  | 'adventure'
  | 'relax'
  | 'food'
  | 'desert'
  | 'local-life'
  | 'water'
  | 'nightlife';

export interface InterestItem {
  id: InterestId;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  image: string;
  alt: string;
}

export const INTERESTS_DATA: InterestItem[] = [
  {
    id: 'diving',
    name: 'Diving',
    nameAr: 'غطس وسكوبا',
    description: 'Explore Dahab underwater.',
    descriptionAr: 'اكتشف عالم تحت المية والشعب المرجانية الأسطورية في دهب.',
    image: IMG_P16826872200634742bd7fd538_CARD,
    alt: 'Scuba diver exploring vibrant coral reefs in the Red Sea',
  },
  {
    id: 'adventure',
    name: 'Adventure',
    nameAr: 'مغامرة وكانيونز',
    description: 'Desert, mountains, and exciting experiences.',
    descriptionAr: 'كانيونز، وادي قني، وتجارب مشي وتسلق في جبال سيناء.',
    image: IMG_P1469854523086cc02fe5d8800_800,
    alt: 'Mountain trekking and canyon exploration in Sinai',
  },
  {
    id: 'relax',
    name: 'Beach & Relax',
    nameAr: 'بحر وراحة بال',
    description: 'Slow mornings, swimming, and time by the sea.',
    descriptionAr: 'صباحيات رايقة ع البحر، عوم، وقعدة شلتات تفصل بيها عن الدنيا.',
    image: IMG_P1507525428034b723cf961d3e_CARD,
    alt: 'Serene beach and turquoise clear Red Sea shoreline',
  },
  {
    id: 'food',
    name: 'Food',
    nameAr: 'أكل ومطاعم',
    description: 'Local food, cafés, and places worth discovering.',
    descriptionAr: 'سمك طازة، مخابز مميزة، وكافيهات اللايتهاوس والممشى.',
    image: IMG_P1555396273367ea4eb4db5_800,
    alt: 'Fresh coastal dining and local Sinai cafe experience',
  },
  {
    id: 'desert',
    name: 'Desert & Safari',
    nameAr: 'سفاري وصحراء',
    description: 'Explore the desert beyond the coast.',
    descriptionAr: 'سفاري بالبيتش باجي، عشاء بدوي تحت النجوم، وقعدات نار حطب.',
    image: IMG_P1509316975850ff9c5deb0cd9_CARD,
    alt: 'Expansive golden Sinai desert safari and mountain valleys',
  },
  {
    id: 'local-life',
    name: 'Local Life',
    nameAr: 'حياة دهب وأهلها',
    description: 'Discover Dahab through its people and everyday places.',
    descriptionAr: 'عيش روح دهب الأصيلة، قعدة الشاي بالحبق، وحكاوي الناس الطيبة.',
    image: IMG_P1526778548025fa2f459cd5c1_800,
    alt: 'Lively Dahab promenade and authentic local village life',
  },
  {
    id: 'water',
    name: 'Water Activities',
    nameAr: 'أنشطة بحرية',
    description: 'Snorkeling, boat trips, and more.',
    descriptionAr: 'سنوركلينج، رحلات مركب للبلو لاجون، وركوب كايت سيرف.',
    image: IMG_P154455176346a013bb70d5_CARD,
    alt: 'Snorkeling and coastal boat excursions along Dahab waters',
  },
  {
    id: 'nightlife',
    name: 'Nightlife',
    nameAr: 'سهرات وقعدات ليلية',
    description: 'Evenings, music, cafés, and social spots.',
    descriptionAr: 'موسيقى لايف ع البحر، قعدات مزيكا رايقة، وسهرات خفيفة.',
    image: IMG_P15103123056538ed496efae75_CARD,
    alt: 'Atmospheric Dahab seaside lounge lit with warm lanterns and music',
  },
];

interface StepInterestsProps {
  selectedInterests: InterestId[];
  onToggleInterest: (id: InterestId) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const StepInterests: React.FC<StepInterestsProps> = ({
  selectedInterests,
  onToggleInterest,
  onContinue,
  onBack,
}) => {
  const { t, isRTL, language } = useLanguage();

  const selectedInterestItems = INTERESTS_DATA.filter((item) =>
    selectedInterests.includes(item.id)
  );

  const selectedSummaryNames = selectedInterestItems
    .map((item) => (language === 'ar' ? item.nameAr || item.name : item.name))
    .join(' · ');

  return (
    <div id="step-interests-container" className="w-full">
      {/* Question Header */}
      <div className="mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--border-subtle)] text-xs font-bold mb-4">
          <Compass className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>{t('planner.step4.badge')}</span>
        </div>

        <h1
          id="interests-question-title"
          className="text-3xl sm:text-4xl md:text-5xl chart-heading text-[var(--text-primary)] tracking-tight leading-[1.12]"
        >
          {t('planner.step4.title')}
        </h1>

        <p
          id="interests-supporting-text"
          className="mt-3 sm:mt-4 text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed font-normal"
        >
          {t('planner.step4.subtitle')}
        </p>
      </div>

      {/* Experience Selection Grid */}
      <div
        id="interests-grid"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 mb-6"
      >
        {INTERESTS_DATA.map((item) => {
          const isSelected = selectedInterests.includes(item.id);
          const displayName = language === 'ar' ? item.nameAr || item.name : item.name;
          const displayDesc = language === 'ar' ? item.descriptionAr || item.description : item.description;

          return (
            <button
              type="button"
              key={item.id}
              id={`interest-card-${item.id}`}
              onClick={() => onToggleInterest(item.id)}
              aria-pressed={isSelected}
              className={`group relative text-start rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 cursor-pointer overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'bg-[var(--surface-container)] border-[var(--accent-secondary)] shadow-lg ring-2 ring-[var(--accent-secondary)]/30'
                  : 'bg-[var(--surface-card)] hover:bg-[var(--surface-container)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)]'
              }`}
            >
              {/* Image Preview Banner */}
              <div className="relative h-28 sm:h-32 w-full overflow-hidden bg-[var(--surface-card)]">
                <img
                  src={item.image}
                  alt={item.alt}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-card)] via-[var(--surface-card)]/40 to-transparent" />

                {/* Selection Indicator Check Pill */}
                <div className={`absolute top-3 ${isRTL ? 'left-3' : 'right-3'} z-10`}>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                      isSelected
                        ? 'bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold shadow-sm ring-2 ring-white/30'
                        : 'bg-black/40 backdrop-blur-md text-[var(--text-muted)] border border-[var(--border-subtle)]'
                    }`}
                  >
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[var(--btn-util-bg)]" />
                    )}
                  </div>
                </div>

                {/* Name Overlay in Image */}
                <div className="absolute bottom-2.5 left-3.5 right-3.5 z-10">
                  <span className={`text-base sm:text-lg font-bold tracking-tight drop-shadow-xs ${isSelected ? 'text-[var(--accent-secondary)]' : 'text-[var(--text-primary)]'}`}>
                    {displayName}
                  </span>
                </div>
              </div>

              {/* Card Footer / Short Description */}
              <div className="p-3.5 sm:p-4 bg-[var(--surface-card)] flex-1 flex flex-col justify-center">
                <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] font-normal leading-snug">
                  {displayDesc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selection Feedback & Summary */}
      <div className="space-y-3 mb-8">
        <div
          id="interests-selection-feedback"
          className="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-[var(--text-primary)]">
              {selectedInterests.length} {t('planner.step4.selectedCount')}
            </span>
            {selectedInterests.length > 0 && (
              <span className="text-[var(--text-muted)] hidden sm:inline">·</span>
            )}
            <span className="text-[var(--accent-primary)] font-semibold truncate max-w-xs sm:max-w-md">
              {selectedSummaryNames}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer Navigation */}
      <div className="pt-6 border-t border-[var(--border-subtle)] flex items-center justify-between gap-4">
        {/* Back Button */}
        <button
          type="button"
          id="planner-interests-back-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-4 py-3 rounded-full hover:bg-[var(--btn-util-bg)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
        >
          {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span>{t('planner.common.back')}</span>
        </button>

        {/* Primary Continue Button */}
        <button
          type="button"
          id="planner-interests-continue-btn"
          onClick={onContinue}
          disabled={selectedInterests.length === 0}
          className={`inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full text-sm font-bold tracking-tight transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-md cursor-pointer group ${
            selectedInterests.length === 0
              ? 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] cursor-not-allowed shadow-none'
              : 'bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] active:scale-[0.98] shadow-lg hover:shadow-xl'
          }`}
        >
          <span>{t('planner.step4.continueBtn')}</span>
          {isRTL ? (
            <ArrowLeft className={`w-4 h-4 group-hover:-translate-x-0.5 transition-transform ${selectedInterests.length === 0 ? 'text-[var(--text-muted)]' : 'text-[var(--surface-card)]'}`} />
          ) : (
            <ArrowRight className={`w-4 h-4 group-hover:translate-x-0.5 transition-transform ${selectedInterests.length === 0 ? 'text-[var(--text-muted)]' : 'text-[var(--surface-card)]'}`} />
          )}
        </button>
      </div>
    </div>
  );
};


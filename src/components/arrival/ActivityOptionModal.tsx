import React from 'react';
import { 
  Coffee, 
  Waves, 
  Footprints, 
  MapPin, 
  Clock, 
  DollarSign, 
  X, 
  Check, 
  Sparkles,
  ArrowRight,
  Compass
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { CategoryIcon } from '../common/CategoryIcon';

interface ActivityOptionModalProps {
  type: 'breakfast' | 'beach' | 'walk' | null;
  onClose: () => void;
  onSelectAction: (title: string) => void;
}

export const ActivityOptionModal: React.FC<ActivityOptionModalProps> = ({
  type,
  onClose,
  onSelectAction,
}) => {
  const { language, isRTL, t } = useLanguage();

  if (!type) return null;

  const contentMap = {
    breakfast: {
      tag: t('arrival.breakfastNearby'),
      title: t('arrival.seasideBreakfastOptions'),
      icon: Coffee,
      iconBg: 'bg-[var(--surface-container)] text-[var(--accent-secondary)]',
      timeNote: t('arrival.1520MinAwayOpen'),
      recommendations: [
        {
          name: t('arrival.shamsRestaurantBedouinCafe'),
          desc: t('arrival.freshEgyptianBreakfastLabneh'),
          distance: t('arrival.150m2MinWalk'),
          vibe: t('arrival.cushionsDirectlyOverThe'),
          price: t('arrival.80140EGPPerPerson'),
        },
        {
          name: t('arrival.ralphsGermanBakery'),
          desc: t('arrival.freshlyBakedSourdoughPretzels'),
          distance: t('arrival.350m5MinWalk'),
          vibe: t('arrival.shadedCourtyardGardenNear'),
          price: t('arrival.110180EGPPerPerson'),
        },
      ],
      primaryAction: t('arrival.headToShamsCafe'),
    },
    beach: {
      tag: t('arrival.beachRelaxation'),
      title: t('arrival.nearbyBeachSpots'),
      icon: Waves,
      iconBg: 'bg-[var(--surface-container)] text-[var(--accent-primary)]',
      timeNote: t('arrival.nearby25MinStroll'),
      recommendations: [
        {
          name: t('arrival.lighthouseBayBeach'),
          desc: t('arrival.calmWaterShadedSunbeds'),
          distance: t('arrival.80m1MinWalk'),
          vibe: t('arrival.vibrantLocalSnorkelingSwimmer'),
          price: t('arrival.freeAccessWithDrink'),
        },
        {
          name: t('arrival.eelGardenBeachfront'),
          desc: t('arrival.quieterReefShoreWith'),
          distance: t('arrival.400m6MinWalk'),
          vibe: t('arrival.peacefulUncrowdedMorningChillout'),
          price: t('arrival.freePublicAccess'),
        },
      ],
      primaryAction: t('arrival.pickLighthouseBeach'),
    },
    walk: {
      tag: t('arrival.relaxedStroll'),
      title: t('arrival.firstWalkAroundDahab'),
      icon: Footprints,
      iconBg: 'bg-[var(--surface-container)] text-[var(--accent-primary)]',
      timeNote: t('arrival.easyPace2040Min'),
      recommendations: [
        {
          name: t('arrival.lighthouseToMashrabaPromenade'),
          desc: t('arrival.scenicSeasideWalkwayLined'),
          distance: t('arrival.startsRightOutside'),
          vibe: t('arrival.carfreePedestrianfriendlyCoastalPath'),
          price: t('arrival.free'),
        },
        {
          name: t('arrival.lighthouseBeaconJettyViewpoint'),
          desc: t('arrival.aQuick10minuteWalk'),
          distance: t('arrival.200mAway'),
          vibe: t('arrival.greatSpotForArrival'),
          price: t('arrival.free'),
        },
      ],
      primaryAction: t('arrival.startPromenadeWalk'),
    },
  };

  const item = contentMap[type];
  const Icon = item.icon;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div 
        className="bg-[var(--surface-card)] rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-primary)]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold border border-[var(--border-subtle)] ${item.iconBg}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                {item.tag}
              </span>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {item.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--accent-primary)] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
            <span>{item.timeNote}</span>
          </span>
          <span className="text-[12px] font-bold text-[var(--accent-primary)] bg-[var(--surface-card)] px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">
            {t('arrival.fitsInYour2h')}
          </span>
        </div>

        {/* Recommendations list */}
        <div className="space-y-3">
          {item.recommendations.map((rec, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className=" font-bold text-sm text-[var(--text-primary)]">
                  {rec.name}
                </h4>
                <span className="text-[11px] font-bold text-[var(--accent-primary)] bg-[var(--surface-card)] px-2 py-0.5 rounded-full flex-shrink-0 border border-[var(--border-subtle)]">
                  {rec.distance}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed">
                {rec.desc}
              </p>
              <div className="pt-1 flex flex-wrap items-center justify-between text-[12px] text-[var(--text-secondary)]/60 border-t border-[var(--border-subtle)] gap-2">
                <span className="inline-flex items-center gap-1"><CategoryIcon kind="sparkles" className="w-3.5 h-3.5" /> {rec.vibe}</span>
                <span className="font-semibold text-[var(--text-primary)]">{rec.price}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              onSelectAction(item.primaryAction);
              onClose();
            }}
            className="w-full py-3.5 px-5 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold text-sm shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Check className="w-4 h-4 text-[var(--surface-card)] stroke-[2.5]" />
            <span>{item.primaryAction}</span>
          </button>
        </div>
      </div>
    </div>
  );
};


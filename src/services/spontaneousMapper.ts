import type { WindowFitOption } from '../shared/types/context';
import type { SpontaneousOption } from '../shared/types/spontaneous';
import type { CategoryKind } from '../components/common/CategoryIcon';
import { addMinutes, formatClock, formatDuration } from '../utils/arrivalTime';

/**
 * Renders a server fit-window candidate as a traveler-facing recommendation.
 *
 * The server has the substance (title, timing, cost, reasons); this maps it
 * onto the `SpontaneousOption` card the "What Should I Do Now?" flow renders.
 * The three-accent accordion (`whyItFits` / `whyThisDetailed` / `whyItWorks`)
 * reads the same honest `reason` text at every depth rather than inventing
 * three sentences from one.
 */

const MOOD_BY_CATEGORY: Record<WindowFitOption['category'], SpontaneousOption['mood']> = {
  dive: 'adventure',
  desert: 'adventure',
  sunset: 'chill',
  relaxation: 'chill',
  food: 'explore',
};

const TAG_BY_MOOD: Record<SpontaneousOption['mood'], Pick<SpontaneousOption, 'tag' | 'tagAr'>> = {
  chill: { tag: 'Chill', tagAr: 'روقان' },
  explore: { tag: 'Explore', tagAr: 'استكشاف' },
  adventure: { tag: 'Adventure', tagAr: 'مغامرة' },
};

const PACE_BY_MOOD: Record<SpontaneousOption['mood'], Pick<SpontaneousOption, 'pace' | 'paceAr'>> = {
  chill: { pace: 'Relaxed', paceAr: 'روقان وهدوء' },
  explore: { pace: 'Easy Stroll', paceAr: 'تمشية خفيفة' },
  adventure: { pace: 'Active', paceAr: 'نشاط وحركة' },
};

const ICON_BY_CATEGORY: Record<WindowFitOption['category'], CategoryKind> = {
  dive: 'dive',
  food: 'food',
  sunset: 'sunset',
  desert: 'desert',
  relaxation: 'relaxation',
};

function toArabicNumber(value: number): string {
  return value.toLocaleString('ar-EG');
}

/**
 * An option "fits tight" when it consumes most of the available window; the
 * UI then warns rather than silently promising comfortable buffer. 85% keeps
 * the smallest seeded candidate (55 min total) safe inside a one-hour window
 * while flagging it once the window shrinks toward 60.
 */
export function isTightFit(totalRequiredMinutes: number, availableMinutes: number): boolean {
  return totalRequiredMinutes > availableMinutes * 0.85;
}

export function windowFitToSpontaneousOption(
  o: WindowFitOption,
  availableMinutes: number
): SpontaneousOption {
  const mood = MOOD_BY_CATEGORY[o.category];
  const { tag, tagAr } = TAG_BY_MOOD[mood];
  const { pace, paceAr } = PACE_BY_MOOD[mood];

  const now = new Date();
  const slotStart = formatClock(now, 'en');
  const slotEnd = formatClock(addMinutes(now, o.totalRequiredMinutes), 'en');

  return {
    id: o.id,
    mood,
    tag,
    tagAr,
    title: o.titleEn,
    titleAr: o.titleAr,
    description: `${o.categoryLabelEn} — ${o.fitHeadlineEn}`,
    descriptionAr: `${o.categoryLabelAr} — ${o.fitHeadlineAr}`,
    duration: formatDuration(o.totalRequiredMinutes, 'en'),
    durationAr: formatDuration(o.totalRequiredMinutes, 'ar'),
    durationMinutes: o.totalRequiredMinutes,
    priceLevel: o.costEgp <= 300 ? 'Low' : 'Moderate',
    priceEstimate: `EGP ${o.costEgp}`,
    priceEstimateAr: `${toArabicNumber(o.costEgp)} ج.م`,
    distance: o.transitMode,
    distanceAr: o.transitModeAr,
    distanceKm: `${o.travelMinutesOneWay} min`,
    pace,
    paceAr,
    icon: ICON_BY_CATEGORY[o.category],
    timeSlot: `${slotStart} – ${slotEnd}`,
    whyItFits: o.reasonEn,
    whyItFitsAr: o.reasonAr,
    whyThisDetailed: o.reasonEn,
    whyThisDetailedAr: o.reasonAr,
    whyItWorks: o.reasonEn,
    whyItWorksAr: o.reasonAr,
    isTightFit: isTightFit(o.totalRequiredMinutes, availableMinutes),
    timeBufferMinutes: availableMinutes - o.totalRequiredMinutes,
    actionRoute: o.actionRoute,
  };
}

export function mapFitWindowOptions(
  options: WindowFitOption[],
  availableMinutes: number
): SpontaneousOption[] {
  return options.map((o) => windowFitToSpontaneousOption(o, availableMinutes));
}
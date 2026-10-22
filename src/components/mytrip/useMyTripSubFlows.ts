import { useState } from 'react';
import type { HelpCategory } from '../help/HelpMeNowView';

export interface MyTripSubFlowInitials {
  briefingOpen?: boolean;
  arrivalOpen?: boolean;
  firstTwoHoursOpen?: boolean;
  day2CompanionOpen?: boolean;
  whatShouldIDoNowOpen?: boolean;
  foodNowOpen?: boolean;
  changeRecoveryOpen?: boolean;
  helpMeNowOpen?: boolean;
}

export type MyTripSubFlowTag =
  | 'help-me-now'
  | 'change-recovery'
  | 'food-now'
  | 'spontaneous'
  | 'day2-companion'
  | 'first-two-hours'
  | 'early-arrival'
  | 'briefing';

/**
 * Owns the sub-flow open states (SOS, Food Now, Spontaneous, briefing,
 * arrival, first-two-hours, day-2 companion, change & recovery) with the
 * cross-navigation callbacks that used to be repeated inline per view.
 */
export function useMyTripSubFlows(initials: MyTripSubFlowInitials) {
  const [isHelpMeNowOpen, setIsHelpMeNowOpen] = useState(Boolean(initials.helpMeNowOpen));
  const [helpCategory, setHelpCategory] = useState<HelpCategory | undefined>(undefined);
  const [helpTopic, setHelpTopic] = useState<string | undefined>(undefined);
  const [isChangeRecoveryOpen, setIsChangeRecoveryOpen] = useState(Boolean(initials.changeRecoveryOpen));
  const [isFoodNowOpen, setIsFoodNowOpen] = useState(Boolean(initials.foodNowOpen));
  const [isWhatShouldIDoNowOpen, setIsWhatShouldIDoNowOpen] = useState(Boolean(initials.whatShouldIDoNowOpen));
  const [isDay2CompanionOpen, setIsDay2CompanionOpen] = useState(Boolean(initials.day2CompanionOpen));
  const [isFirstTwoHoursOpen, setIsFirstTwoHoursOpen] = useState(Boolean(initials.firstTwoHoursOpen));
  const [isEarlyArrivalOpen, setIsEarlyArrivalOpen] = useState(Boolean(initials.arrivalOpen));
  const [isBriefingViewOpen, setIsBriefingViewOpen] = useState(Boolean(initials.briefingOpen));

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const closeAll = () => {
    setIsHelpMeNowOpen(false);
    setIsChangeRecoveryOpen(false);
    setIsFoodNowOpen(false);
    setIsWhatShouldIDoNowOpen(false);
    setIsDay2CompanionOpen(false);
    setIsFirstTwoHoursOpen(false);
    setIsEarlyArrivalOpen(false);
    setIsBriefingViewOpen(false);
  };

  const openHelp = (category?: HelpCategory, topic?: string, scroll = true) => {
    closeAll();
    if (category) setHelpCategory(category);
    if (topic) setHelpTopic(topic);
    setIsHelpMeNowOpen(true);
    if (scroll) scrollToTop();
  };
  const toFood = () => {
    closeAll();
    setIsFoodNowOpen(true);
    scrollToTop();
  };
  const toSpontaneous = () => {
    closeAll();
    setIsWhatShouldIDoNowOpen(true);
    scrollToTop();
  };
  const toChangeRecovery = () => {
    closeAll();
    setIsChangeRecoveryOpen(true);
    scrollToTop();
  };
  const toCompanion = () => {
    closeAll();
    setIsDay2CompanionOpen(true);
    scrollToTop();
  };
  const toFirstTwoHours = () => {
    closeAll();
    setIsFirstTwoHoursOpen(true);
    scrollToTop();
  };
  const toArrival = () => {
    closeAll();
    setIsEarlyArrivalOpen(true);
    scrollToTop();
  };
  const toBriefing = () => {
    closeAll();
    setIsBriefingViewOpen(true);
    scrollToTop();
  };
  const backToTrip = () => {
    closeAll();
    scrollToTop();
  };

  // Routing priority matches the original MyTripView switch order.
  const activeView: MyTripSubFlowTag | null = isHelpMeNowOpen
    ? 'help-me-now'
    : isChangeRecoveryOpen
      ? 'change-recovery'
      : isFoodNowOpen
        ? 'food-now'
        : isWhatShouldIDoNowOpen
          ? 'spontaneous'
          : isDay2CompanionOpen
            ? 'day2-companion'
            : isFirstTwoHoursOpen
              ? 'first-two-hours'
              : isEarlyArrivalOpen
                ? 'early-arrival'
                : isBriefingViewOpen
                  ? 'briefing'
                  : null;

  return {
    activeView,
    helpCategory,
    helpTopic,
    openHelp,
    toFood,
    toSpontaneous,
    toChangeRecovery,
    toCompanion,
    toFirstTwoHours,
    toArrival,
    toBriefing,
    backToTrip,
  };
}

export type MyTripSubFlowsState = ReturnType<typeof useMyTripSubFlows>;
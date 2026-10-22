import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTrip } from '../../context/TripContext';
import { PreArrivalBriefing } from '../briefing/PreArrivalBriefing';
import { EarlyArrivalView } from '../arrival/EarlyArrivalView';
import { FirstTwoHoursView } from '../arrival/FirstTwoHoursView';
import { DailyCompanionDay2View } from '../companion/DailyCompanionDay2View';
import { WhatShouldIDoNowView } from '../spontaneous/WhatShouldIDoNowView';
import { FoodNowView } from '../food/FoodNowView';
import { ChangeAndRecoveryView } from '../recovery/ChangeAndRecoveryView';
import { HelpMeNowView } from '../help/HelpMeNowView';
import type { MyTripSubFlowsState } from './useMyTripSubFlows';

interface MyTripSubFlowsProps {
  sub: MyTripSubFlowsState;
  onExploreClick?: () => void;
  /** Minutes until the next scheduled activity, from MyTripView. */
  availableMinutes?: number;
}

export const MyTripSubFlows: React.FC<MyTripSubFlowsProps> = ({ sub, onExploreClick, availableMinutes }) => {
  const { language , t} = useLanguage();
  const { showToast } = useTrip();

  switch (sub.activeView) {
    case 'help-me-now':
      return (
        <HelpMeNowView
          onBackToMyTrip={sub.backToTrip}
          onBackToCompanion={sub.toCompanion}
          onNavigateToChangeRecovery={sub.toChangeRecovery}
          onNavigateToArrival={sub.toArrival}
          onExploreClick={onExploreClick}
          initialCategory={sub.helpCategory}
          initialTopic={sub.helpTopic}
        />
      );

    case 'change-recovery':
      return (
        <ChangeAndRecoveryView
          onBackToMyTrip={sub.backToTrip}
          onBackToCompanion={sub.toCompanion}
          onExploreClick={onExploreClick}
          onOpenHelp={(topic) => sub.openHelp('activity', topic || 'Activity changed', true)}
          onTripUpdated={({ activity, newTime, day }) => {
            showToast(`"${activity}" confirmed for ${day || newTime} ✓`);
          }}
        />
      );

    case 'food-now':
      return (
        <FoodNowView
          onBackToMyTrip={sub.backToTrip}
          onBackToCompanion={sub.toCompanion}
          onExploreClick={onExploreClick}
          onOpenHelp={() => sub.openHelp(undefined, undefined, false)}
          onMealAddedToTrip={(meal) => {
            showToast(`"${meal.title}" added to your timeline ✓`);
          }}
        />
      );

    case 'spontaneous':
      return (
        <WhatShouldIDoNowView
          onBackToMyTrip={sub.backToTrip}
          onBackToCompanion={sub.toCompanion}
          onNavigateToFoodNow={sub.toFood}
          onExploreClick={onExploreClick}
          onOpenHelp={() => sub.openHelp(undefined, undefined, false)}
          onActivityAddedToTrip={(act) => {
            showToast(`"${act.title}" added to schedule ✓`);
          }}
          availableMinutes={availableMinutes}
        />
      );

    case 'day2-companion':
      return (
        <DailyCompanionDay2View
          onBackToMyTrip={sub.backToTrip}
          onNavigateToChangeRecovery={sub.toChangeRecovery}
          onNavigateToFoodNow={sub.toFood}
          onNavigateToWhatShouldIDoNow={sub.toSpontaneous}
          onNavigateToFirstTwoHours={sub.toFirstTwoHours}
          onNavigateToEarlyArrival={sub.toArrival}
          onExploreClick={onExploreClick}
          onOpenHelp={() => sub.openHelp(undefined, undefined, false)}
        />
      );

    case 'first-two-hours':
      return (
        <FirstTwoHoursView
          onBackToMyTrip={sub.backToTrip}
          onBackToEarlyArrival={sub.toArrival}
          onExploreClick={onExploreClick}
          onOpenHelp={() => sub.openHelp(undefined, undefined, false)}
        />
      );

    case 'early-arrival':
      return (
        <EarlyArrivalView
          onBackToMyTrip={sub.backToTrip}
          onNavigateToFirstTwoHours={sub.toFirstTwoHours}
          onExploreClick={onExploreClick}
          onOpenHelp={() => sub.openHelp()}
        />
      );

    case 'briefing':
      return (
        <PreArrivalBriefing
          onBackToMyTrip={sub.backToTrip}
          onReadyConfirmed={() => {
            sub.toFirstTwoHours();
            showToast(t('myTrip.welcomeToDahabFirst'));
          }}
          onOpenHelp={() => sub.openHelp(undefined, undefined, false)}
        />
      );

    default:
      return null;
  }
};
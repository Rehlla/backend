import React from 'react';
import { ConciergeHome } from './concierge/ConciergeHome';

interface V2HomeCockpitProps {
  onOpenQuickBook: () => void;
}

/**
 * Homepage shell. The page itself is ConciergeHome (destination-aware).
 *
 * The floating back-to-top button is gone: on phones it sat over content
 * just above the tab bar, and re-tapping the active tab now scrolls to the
 * top instead (AppTabBar), the convention people already know from native
 * apps. The page's one <h1> is the hero headline.
 */
export const V2HomeCockpit: React.FC<V2HomeCockpitProps> = () => (
  <div className="w-full bg-dg-bg text-dg-ink">
    <ConciergeHome />
  </div>
);

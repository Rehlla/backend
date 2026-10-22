import React from 'react';

interface TravelerNavProps {
  activeTab?: 'home' | 'mytrip' | 'explore' | 'bookings' | 'profile';
  onNavigate?: (tab: 'home' | 'mytrip' | 'explore' | 'bookings' | 'profile') => void;
  onOpenHelp?: () => void;
}

export const TravelerNav: React.FC<TravelerNavProps> = () => {
  // Navigation is globally managed by V2Navbar in App.tsx to prevent duplicate headers
  return null;
};


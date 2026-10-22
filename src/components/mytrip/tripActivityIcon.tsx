import { Building, Car, Compass, Sparkles, Utensils, Waves } from 'lucide-react';
import type { TimelineActivity } from './myTripData';

// Activity icon helper
export const getActivityIcon = (type: TimelineActivity['type'] | string, title: string) => {
  const tLower = title.toLowerCase();
  if (tLower.includes('div') || tLower.includes('reef') || tLower.includes('غطس') || tLower.includes('شعب')) {
    return <Waves className="w-4 h-4 text-[var(--accent-primary)]" />;
  }
  if (tLower.includes('food') || tLower.includes('eat') || tLower.includes('bakery') || tLower.includes('cafe') || tLower.includes('أكل') || tLower.includes('مطعم') || tLower.includes('سمك')) {
    return <Utensils className="w-4 h-4 text-[var(--accent-secondary)]" />;
  }
  if (tLower.includes('safari') || tLower.includes('canyon') || tLower.includes('سفاري') || tLower.includes('كانيون') || tLower.includes('وادي')) {
    return <Compass className="w-4 h-4 text-[#EA8E75]" />;
  }
  if (type === 'Transfer' || type === 'Arrival' || tLower.includes('transfer') || tLower.includes('توصيل') || tLower.includes('تاكسي')) {
    return <Car className="w-4 h-4 text-[var(--accent-primary)]" />;
  }
  if (type === 'Accommodation' || tLower.includes('hotel') || tLower.includes('فندق') || tLower.includes('منتجع')) {
    return <Building className="w-4 h-4 text-[var(--accent-primary)]" />;
  }
  return <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />;
};
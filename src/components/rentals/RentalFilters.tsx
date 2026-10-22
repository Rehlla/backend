import React from 'react';
import type { RentalCategory } from '../../shared/types/commerce';

interface RentalFiltersProps {
  activeCategory: string | null;
  onCategoryChange: (cat: string | null) => void;
  activeZone: string | null;
  onZoneChange: (zone: string | null) => void;
  priceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  onReset: () => void;
  filtersActive: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  isAr: boolean;
}

const ZONES = [
  { id: 'lighthouse', name: 'Lighthouse', nameAr: 'اللايتهاوس' },
  { id: 'mashraba', name: 'Mashraba', nameAr: 'المسبط' },
  { id: 'assalah', name: 'Assalah', nameAr: 'العسلة' },
  { id: 'center', name: 'City Center', nameAr: 'المركز' },
];

const CATEGORIES = [
  { id: null, label: 'all', labelAr: 'الكل' },
  { id: 'bike', label: 'Bike', labelAr: 'دراجة عادية' },
  { id: 'e-bike', label: 'E-bike', labelAr: 'دراجة كهربائية' },
];

const SORT_OPTIONS = [
  { value: 'featured', label: 'rentals.featured', labelAr: 'مميز أولاً' },
  { value: 'price_asc', label: 'rentals.priceAsc', labelAr: 'السعر: الأقل أولاً' },
  { value: 'price_desc', label: 'rentals.priceDesc', labelAr: 'السعر: الأعلى أولاً' },
  { value: 'rating', label: 'rentals.rating', labelAr: 'الأعلى تقييماً' },
];

export const RentalFilters: React.FC<RentalFiltersProps> = ({
  activeCategory,
  onCategoryChange,
  activeZone,
  onZoneChange,
  priceRange,
  onPriceRangeChange,
  sortBy,
  onSortChange,
  onReset,
  filtersActive,
  t,
  isAr,
}) => {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 space-y-4">
      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => {
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                active
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--surface-container)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
              }`}
            >
              {isAr ? cat.labelAr : cat.label}
            </button>
          );
        })}
      </div>

      {/* Zones */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onZoneChange(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            activeZone === null
              ? 'bg-[var(--accent-secondary)] text-white'
              : 'bg-[var(--surface-container)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
          }`}
        >
          {isAr ? 'المنطقة: كلها' : 'Zone: All'}
        </button>
        {ZONES.map(zone => {
          const active = activeZone === zone.id;
          return (
            <button
              key={zone.id}
              onClick={() => onZoneChange(active ? null : zone.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                active
                  ? 'bg-[var(--accent-secondary)] text-white'
                  : 'bg-[var(--surface-container)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
              }`}
            >
              {isAr ? zone.nameAr : zone.name}
            </button>
          );
        })}
      </div>

      {/* Price Range */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-[var(--text-secondary)]">{t('rentals.priceRange')}</span>
        <input
          type="range"
          min={0}
          max={5000}
          step={500}
          value={priceRange[1]}
          onChange={(e) => onPriceRangeChange([0, Number(e.target.value)])}
          className="flex-1"
        />
        <span className="text-xs font-bold text-[var(--accent-primary)]">
          {priceRange[1] === 5000 ? '5000+' : priceRange[1].toLocaleString()}
        </span>
        <span className="text-xs text-[var(--text-secondary)]">EGP</span>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-[var(--text-secondary)]">{isAr ? 'ترتيب:' : 'Sort:'}</span>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] text-xs font-bold text-[var(--text-primary)]"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {isAr ? opt.labelAr : opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Reset */}
      {filtersActive && (
        <button
          onClick={onReset}
          className="w-full py-2 rounded-lg text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors border border-dashed border-[var(--border-subtle)]"
        >
          {isAr ? 'إعادة ضبط الفلاتر' : 'Reset filters'}
        </button>
      )}
    </div>
  );
};

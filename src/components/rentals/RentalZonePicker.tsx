import React from 'react';

interface RentalZonePickerProps {
  zones: Array<{ id: string; name: string; nameAr: string }>;
  selectedZone: string | null;
  onSelect: (zoneId: string | null) => void;
  t: (key: string) => string;
  isAr: boolean;
}

export const RentalZonePicker: React.FC<RentalZonePickerProps> = ({
  zones,
  selectedZone,
  onSelect,
  t,
  isAr,
}) => {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
          selectedZone === null
            ? 'bg-[var(--accent-secondary)] text-white'
            : 'bg-[var(--surface-container)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
        }`}
      >
        {isAr ? 'المنطقة: كلها' : 'Zone: All'}
      </button>
      {zones.map(zone => {
        const active = selectedZone === zone.id;
        return (
          <button
            key={zone.id}
            onClick={() => onSelect(active ? null : zone.id)}
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
  );
};

import React from 'react';
import { Star, MapPin, BedDouble, Users } from 'lucide-react';
import { CmsImage } from '../common/CmsImage';
import type { AccommodationEntity } from '../../shared/types/commerce';

interface PropertyHeaderProps {
  accommodation: AccommodationEntity;
  gallery: string[];
  focal?: { x: number; y: number };
  srcSet?: string;
  pageTitle: string;
  /** Single deduplicated row, e.g. ["Eco-lodge", "Budget", "Moderate"]. */
  tags: string[];
  areaLabel: string;
  capacityLabel: string;
  isRoomBased: boolean;
  chips: string[];
  description: string;
  note?: string;
  isAr: boolean;
}

/**
 * Gallery + single tag row + title + meta for the stay detail page.
 */
export const PropertyHeader: React.FC<PropertyHeaderProps> = ({
  accommodation,
  gallery,
  focal,
  srcSet,
  pageTitle,
  tags,
  areaLabel,
  capacityLabel,
  isRoomBased,
  chips,
  description,
  note,
  isAr,
}) => {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8 rounded-xl overflow-hidden">
        <div className="md:col-span-2 relative h-72 sm:h-96 overflow-hidden group rounded-xl">
          <CmsImage
            src={gallery[0]}
            alt={pageTitle}
            focalX={focal?.x}
            focalY={focal?.y}
            srcSet={srcSet}
            sizes="(max-width: 768px) 100vw, 66vw"
            fetchPriority="high"
            loading="eager"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
        <div className="hidden md:flex flex-col gap-3 h-96">
          <div className="relative flex-1 overflow-hidden group rounded-xl">
            <img
              src={gallery[1] || gallery[0]}
              alt={pageTitle}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </div>
          <div className="relative flex-1 overflow-hidden group rounded-xl">
            <img
              src={gallery[2] || gallery[0]}
              alt={pageTitle}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-label={isAr ? 'تصنيفات الإقامة' : 'Stay categories'}>
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
          >
            {tag}
          </span>
        ))}
      </div>

      <h1 className="mt-3 font-display text-[28px] leading-[1.3] font-semibold tracking-tight text-balance">
        {pageTitle}
      </h1>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-[var(--accent-primary)]">
          <Star className="w-4 h-4 fill-current" aria-hidden="true" />
          {accommodation.rating.toFixed(1)}
          <span className="font-normal text-[var(--text-secondary)]">({accommodation.reviewCount})</span>
        </span>
        <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          <MapPin className="w-4 h-4" aria-hidden="true" />
          {areaLabel}
        </span>
        <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          {isRoomBased ? <BedDouble className="w-4 h-4" aria-hidden="true" /> : <Users className="w-4 h-4" aria-hidden="true" />}
          {capacityLabel}
        </span>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {chips.slice(0, 8).map((c, i) => (
            <span key={i} className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
              {c}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 text-[15px] leading-relaxed max-w-2xl text-[var(--text-secondary)]">
        {description}
      </p>

      {note && (
        <p className="mt-2 text-sm leading-relaxed max-w-2xl text-[var(--text-secondary)]">
          {note}
        </p>
      )}
    </div>
  );
};

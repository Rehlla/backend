import { AccommodationCard } from './AccommodationCard';
import type { AccommodationEntity } from '../../shared/types/commerce';

interface AccommodationListProps {
  accommodations: AccommodationEntity[];
  isDark: boolean;
  onOpen: (slug: string) => void;
  /** When true, the highest-rated item renders as a featured card above the grid. */
  featuredId?: string | null;
}

/**
 * Grid of accommodation cards. The first entry matching `featuredId` (if any)
 * gets the featured treatment; the rest render as normal cards.
 *
 * Reuses AccommodationCard directly — same shape the existing AccommodationsView
 * passes, so the card's tilt-photo, save-heart, compare-modal and "View stay"
 * CTA all work without adaptation.
 */
export const AccommodationList: React.FC<AccommodationListProps> = ({
  accommodations,
  isDark,
  onOpen,
  featuredId,
}) => {
  const featured = featuredId != null ? accommodations.find(a => a.id === featuredId) : null;
  const rest = featuredId != null
    ? accommodations.filter(a => a.id !== featuredId)
    : accommodations;

  return (
    <div>
      {featured && (
        <div className="mb-12">
          <AccommodationCard
            accommodation={featured}
            isDark={isDark}
            featured
            onOpen={onOpen}
          />
        </div>
      )}
      {rest.length > 0 && (
        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          }}
        >
          {rest.map(a => (
            <AccommodationCard
              key={a.id}
              accommodation={a}
              isDark={isDark}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AccommodationList;

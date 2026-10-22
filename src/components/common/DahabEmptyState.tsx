import React from 'react';
import {
  AlertTriangle,
  Blocks,
  FileText,
  History,
  Home,
  Image as ImageIcon,
  Layout as LayoutIcon,
  Menu,
  Search,
} from 'lucide-react';
import { DahabMotif } from './DahabMotifs';
import { DahabIcon, DahabIconName } from './DahabIcons';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * Generic UI icon names accepted alongside the bespoke DahabIconName set.
 * Admin screens describe empty states with everyday UI metaphors (search,
 * blocks, history) that have no handcrafted Sinai equivalent; these render
 * their lucide counterpart inside the same organic container.
 */
export type EmptyStateIconName = DahabIconName | 'layout' | 'search' | 'alert-triangle' | 'blocks' | 'home' | 'menu' | 'file-text' | 'history' | 'image';

const GENERIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  layout: LayoutIcon,
  search: Search,
  'alert-triangle': AlertTriangle,
  blocks: Blocks,
  home: Home,
  menu: Menu,
  'file-text': FileText,
  history: History,
  image: ImageIcon,
};

export interface DahabEmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  iconName?: EmptyStateIconName;
  motifName?: 'wave-divider' | 'topo-contour' | 'reef-art' | 'footprint';
  className?: string;
}

/**
 * DAHAB VISUAL LANGUAGE SYSTEM
 * Storytelling Empty State Primitive with Level C Egyptian Arabic support
 */
export const DahabEmptyState: React.FC<DahabEmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  iconName = 'compass',
  motifName = 'reef-art',
  className = '',
}) => {
  const { t, isRTL } = useLanguage();

  const displayTitle = title || t('empty.searchTitle', 'No Exact Matches Found');
  const displayDescription = description || t('empty.searchDesc', 'Try searching for keywords like "Diving", "Canyon", "Breakfast", "Ralphs", or "Taxi".');

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`relative w-full max-w-lg mx-auto py-12 px-6 rounded-3xl bg-[var(--surface-card)] border border-dahab-ink/10 shadow-sm text-center overflow-hidden space-y-5 ${className}`}
    >
      {/* Background Topo Motifs */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <DahabMotif name="topo-contour" className="text-dahab-sand/40" />
      </div>

      <div className="relative z-10 space-y-4">
        {/* Central Organic Icon Container */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--surface-container)]/5 border border-[var(--accent-primary)]/25 text-[var(--accent-primary)] flex items-center justify-center shadow-xs">
          {GENERIC_ICONS[iconName]
            ? React.createElement(GENERIC_ICONS[iconName], { className: 'w-8 h-8' })
            : <DahabIcon name={iconName as DahabIconName} size={32} accent />}
        </div>

        <div className="space-y-1.5 max-w-sm mx-auto">
          <h2 className="text-lg font-bold text-dahab-ink">
            {displayTitle}
          </h2>
          <p className="text-xs sm:text-sm text-dahab-ink-secondary leading-relaxed">
            {displayDescription}
          </p>
        </div>

        {/* Action Button */}
        {actionText && onAction && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--surface-container)] text-[var(--accent-primary-ink)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-xs cursor-pointer active:scale-95"
            >
              <span>{actionText}</span>
            </button>
          </div>
        )}
      </div>

      {/* Subtle Wave Divider Footer */}
      <div className="relative z-10 pt-2 text-[var(--accent-primary)]/25">
        <DahabMotif name="wave-divider" strokeWidth={1} />
      </div>
    </div>
  );
};

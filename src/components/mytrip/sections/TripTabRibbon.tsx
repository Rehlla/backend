import React from 'react';
import { Calendar, Compass, CreditCard } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';

export type MyTripTabId = 'timeline' | 'bookings' | 'tools';

interface TripTabRibbonProps {
  activeTab: MyTripTabId;
  onTabChange: (tab: MyTripTabId) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export const TripTabRibbon: React.FC<TripTabRibbonProps> = ({
  activeTab,
  onTabChange,
  onExpandAll,
  onCollapseAll,
}) => {
  const { language, t } = useLanguage();
  const { isDark } = useTheme();

  return (
    <div className="flex items-center justify-between gap-4 border-b pb-4 flex-wrap border-current/10">
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { id: 'timeline' as const, label: t('myTrip.tabTimeline'), icon: Calendar },
          { id: 'bookings' as const, label: t('myTrip.tabBookings'), icon: CreditCard },
          { id: 'tools' as const, label: t('myTrip.tabTools'), icon: Compass }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              id={`dashboard-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`px-5 py-3 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-colors cursor-pointer shadow-xs whitespace-nowrap ${
                isActive
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] shadow-md'
                  : isDark
                  ? 'bg-[var(--surface-card)] text-[var(--text-secondary)] hover:bg-[var(--surface-container)] border border-white/5'
                  : 'bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-container)] border border-[var(--border-subtle)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Expand / Collapse buttons when in Timeline tab */}
      {activeTab === 'timeline' && (
        <div className="flex items-center gap-2 text-xs font-bold">
          <button
            type="button"
            id="timeline-expand-all-btn"
            onClick={onExpandAll}
            className={`px-3 py-1.5 rounded-xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
              isDark ? 'bg-[var(--surface-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--surface-container)]' : 'bg-[var(--surface-card)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:bg-[var(--surface-container)]'
            }`}
          >
            {t('myTrip.expandAll')}
          </button>
          <button
            type="button"
            id="timeline-collapse-all-btn"
            onClick={onCollapseAll}
            className={`px-3 py-1.5 rounded-xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
              isDark ? 'bg-[var(--surface-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--surface-container)]' : 'bg-[var(--surface-card)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:bg-[var(--surface-container)]'
            }`}
          >
            {t('myTrip.collapseAll')}
          </button>
        </div>
      )}
    </div>
  );
};
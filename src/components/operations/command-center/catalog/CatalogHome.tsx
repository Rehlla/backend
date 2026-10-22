import React from 'react';
import { BedDouble, Bus, Car, ClipboardCheck, Compass, FilePen, Layers, Map as MapIcon, Package, Plus, UserRound, Utensils } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { api } from '../../../../services/api';
import type { CatalogScope, CatalogStatus, CatalogTypeSchema } from '../../../../types/catalog';
import { KpiCard, SkeletonCard } from '../ui';
import { primaryButtonClass, useLoader } from '../control/controlShared';
import { pickText } from './catalogShared';

/**
 * Catalogue home: one card per type with its count, drafts and items waiting
 * for review, and a "+ New" button. Counts are three `limit=1` list calls per
 * type (the list `total` is the count).
 */

const ICONS: Record<string, React.ElementType> = {
  bed: BedDouble, hotel: BedDouble, utensils: Utensils, restaurant: Utensils, car: Car, bus: Bus,
  user: UserRound, driver: UserRound, map: MapIcon, compass: Compass, activity: Compass, package: Package,
};

export function typeIcon(schema: CatalogTypeSchema): React.ElementType {
  return (schema.icon && ICONS[schema.icon]) || ICONS[schema.type] || Layers;
}

interface Counts {
  total: number;
  draft: number;
  review: number;
}

async function countsFor(scope: CatalogScope, type: string, signal: AbortSignal): Promise<Counts | null> {
  const count = (status?: CatalogStatus) =>
    api.catalogList(scope, type, { limit: 1, ...(status ? { status } : {}) }, signal).then(r => r.total ?? r.items.length);
  try {
    const [total, draft, review] = await Promise.all([count(), count('draft'), count('review')]);
    return { total, draft, review };
  } catch {
    return null;
  }
}

export interface CatalogHomeProps {
  scope: CatalogScope;
  types: CatalogTypeSchema[];
  onOpenList: (type: string, status?: CatalogStatus) => void;
  onNew: (type: string) => void;
  canManage: (type: string) => boolean;
}

export function CatalogHome({ scope, types, onOpenList, onNew, canManage }: CatalogHomeProps) {
  const { t, language } = useLanguage();
  const { data, loading } = useLoader(
    async signal => {
      const entries = await Promise.all(types.map(async ty => [ty.type, await countsFor(scope, ty.type, signal)] as const));
      return Object.fromEntries(entries) as Record<string, Counts | null>;
    },
    [scope, types.map(ty => ty.type).join(',')]
  );

  const sum = (k: keyof Counts) => Object.values(data ?? {}).reduce((a, c) => a + (c?.[k] ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard icon={Layers} label={t('cat.home.total')} value={loading ? '—' : sum('total')} />
        <KpiCard icon={FilePen} label={t('cat.home.drafts')} value={loading ? '—' : sum('draft')} />
        <KpiCard icon={ClipboardCheck} iconColor="text-amber-400" label={t('cat.home.review')} value={loading ? '—' : sum('review')} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {types.map(ty => {
          const Icon = typeIcon(ty);
          const c = data?.[ty.type];
          if (loading && !data) return <SkeletonCard key={ty.type} />;
          return (
            <article key={ty.type} data-testid={`catalog-type-${ty.type}`} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-4 flex flex-col gap-3">
              <button type="button" onClick={() => onOpenList(ty.type)} className="flex items-start gap-3 text-start cursor-pointer group">
                <span className="w-9 h-9 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-primary)]">
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[var(--text-primary)] group-hover:underline">{pickText(ty.label, language) || ty.type}</span>
                  <span className="block text-2xl font-bold font-mono text-[var(--text-primary)]">{c ? c.total.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US') : '—'}</span>
                </span>
              </button>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <button type="button" onClick={() => onOpenList(ty.type, 'draft')} className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                  {t('cat.home.draftsN', { n: c?.draft ?? 0 })}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenList(ty.type, 'review')}
                  className={`rounded-full border px-2 py-0.5 cursor-pointer ${c && c.review > 0 ? 'border-amber-500/40 text-amber-400' : 'border-[var(--border-subtle)] text-[var(--text-muted)]'}`}
                >
                  {t('cat.home.reviewN', { n: c?.review ?? 0 })}
                </button>
                {canManage(ty.type) && (
                  <button type="button" className={`${primaryButtonClass} ms-auto`} onClick={() => onNew(ty.type)}>
                    <Plus className="w-3 h-3" /> {t('cat.new')}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default CatalogHome;

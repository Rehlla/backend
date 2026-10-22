import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';
import { useDestination } from '../../context/DestinationContext';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { DESTINATIONS, DESTINATION_IDS, ALL_DESTINATION_IDS, type DestinationId } from '../../design/destinations';
import { DestinationScene } from '../brand/DestinationScene';
import { Sheet } from '../ui/sheet';
import { Badge } from '../ui/badge';
import { haptic } from '../../design/feedback';

/**
 * The place picker. A pill in the header shows where you are; the sheet
 * presents each destination as a landscape with its mood, so the choice is
 * about the feeling of the place, not a dropdown of town names. Choosing one
 * re-themes the whole product (DestinationContext).
 */
export const DestinationSwitcher: React.FC<{ tone?: 'chrome' | 'media'; className?: string }> = ({ tone = 'chrome', className }) => {
  const { destinationId, setDestination } = useDestination();
  const { currentRoute, navigateTo } = useTrip();
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const current = DESTINATIONS[destinationId];

  const choose = (id: DestinationId) => {
    haptic('tap');
    setOpen(false);
    // Keep the screen on the same surface: a city-scoped view retargets to
    // the newly chosen place instead of showing data for a city the pill no
    // longer names (the earlier /hotels header-vs-content mismatch).
    const scoped = currentRoute === '/hotels' ? '/hotels' : currentRoute === '/cities' ? '/cities' : null;
    // Let the sheet start closing before the page re-themes underneath it.
    window.setTimeout(() => {
      setDestination(id);
      if (scoped === '/hotels') navigateTo('/hotels', { city: id });
      else if (scoped === '/cities') navigateTo('/cities', { citySlug: id });
    }, reduce ? 0 : 160);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('shell.destination.trigger', { name: current.name[language] })}
        aria-haspopup="dialog"
        className={cn(
          'inline-flex items-center gap-2 h-10 ps-1.5 pe-3 rounded-full border text-sm font-semibold transition-colors',
          tone === 'media'
            ? 'border-white/30 bg-white/15 text-white backdrop-blur-md hover:bg-white/25'
            : 'border-dg-line-strong bg-dg-surface text-dg-ink hover:bg-dg-action-wash',
          className,
        )}
      >
        <span
          className="h-7 w-7 rounded-full border-2 border-white/70 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${current.swatch[0]} 50%, ${current.swatch[1]} 50%)` }}
          aria-hidden="true"
        />
        <span>{current.name[language]}</span>
        <ChevronDown className="h-4 w-4 opacity-70" aria-hidden="true" />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('shell.destination.choose')}
        description={t('shell.destination.chooseHint')}
        closeLabel={t('shell.close')}
        size="lg"
      >
        <ul className="grid gap-3 sm:grid-cols-3">
          {DESTINATION_IDS.map((id, i) => {
            const d = DESTINATIONS[id];
            const active = id === destinationId;
            return (
              <motion.li
                key={id}
                initial={reduce ? false : { y: 12 }}
                animate={{ y: 0 }}
                transition={{ delay: reduce ? 0 : 0.05 * i, type: 'spring', stiffness: 380, damping: 32 }}
              >
                <button
                  type="button"
                  onClick={() => choose(id)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'group w-full overflow-hidden rounded-dg-lg border text-start transition-[transform,border-color,box-shadow] duration-300 ease-dg-out',
                    'active:scale-[0.98] hover:shadow-dg-card',
                    active ? 'border-dg-action ring-2 ring-dg-action/30' : 'border-dg-line hover:border-dg-line-strong',
                  )}
                >
                  <span className="relative block aspect-[21/8] sm:aspect-[4/3] overflow-hidden">
                    <DestinationScene id={id} className="absolute inset-0 h-full w-full transition-transform duration-700 ease-dg-out group-hover:scale-[1.04]" />
                    {active && (
                      <span className="absolute top-2.5 end-2.5 grid h-7 w-7 place-items-center rounded-full bg-white bg-white-override text-[#0B151C] shadow">
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="block p-3.5">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-dg-display text-lg font-semibold">{d.name[language]}</span>
                      {d.catalogue === 'early' && <Badge tone="neutral">{t('shell.destination.early')}</Badge>}
                      {active && d.catalogue === 'live' && <Badge tone="action">{t('shell.destination.current')}</Badge>}
                    </span>
                    <span className="mt-1 block text-sm text-dg-ink-2">{d.tagline[language]}</span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {d.mood[language].map((m) => (
                        <span key={m} className="rounded-full bg-dg-sunken px-2 py-0.5 text-[0.75rem] text-dg-ink-2">
                          {m}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              </motion.li>
            );
          })}
        </ul>

        {/* The five moods above are the promoted set; every rebuilt city stays
            reachable too. On /hotels or /cities a chip applies the same
            retargeting, so the pill and the content stay one city. */}
        {ALL_DESTINATION_IDS.some(id => !(DESTINATION_IDS as readonly string[]).includes(id)) && (
          <div className="mt-4 border-t border-dg-line pt-4">
            <p className="mb-2 text-[0.8125rem] font-semibold text-dg-ink-2">{t('shell.destination.choose')}</p>
            <ul className="flex flex-wrap gap-2">
              {ALL_DESTINATION_IDS.filter(id => !(DESTINATION_IDS as readonly string[]).includes(id)).map(id => {
                const d = DESTINATIONS[id];
                const active = id === destinationId;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => choose(id)}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                        active
                          ? 'border-dg-action bg-dg-action text-dg-action-ink'
                          : 'bg-dg-surface text-dg-ink border-dg-line hover:border-dg-line-strong',
                      )}
                    >
                      <span
                        className="h-4 w-4 rounded-full"
                        style={{ background: `linear-gradient(135deg, ${d.swatch[0]} 50%, ${d.swatch[1]} 50%)` }}
                        aria-hidden="true"
                      />
                      {d.name[language]}
                      {d.catalogue === 'early' && !active && (
                        <span className="text-[0.65rem] text-dg-ink-3">{t('shell.destination.early')}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Sheet>
    </>
  );
};

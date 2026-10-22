import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  PARTY_CATEGORY_COLORS,
  PARTY_ZONE_INFO,
  PARTY_ZONE_MAP_POSITIONS,
  type PartyCategory,
  type PartyView,
  type PartyZone
} from '../../shared/dahabParties';

/**
 * The stylized Dahab nightlife map.
 *
 * Deliberately NOT Mapbox/Google Maps JS: those SDKs cost 300-500 KB of entry
 * chunk, and this screen must stay under the 650 KB gate. A hand-drawn SVG of
 * the coast carries the actual product need — where is tonight concentrated,
 * and what KIND of night is where — with zero bytes of map SDK. Every pin is
 * still a real coordinate summary; the "Open in Google Maps" handoff on the
 * detail screen is where turn-by-turn belongs.
 */

interface PartyZoneMapProps {
  parties: PartyView[];
  /** Zone currently filtered; null = all zones. */
  activeZone: PartyZone | null;
  onSelectZone: (zone: PartyZone | null) => void;
}

export const PartyZoneMap: React.FC<PartyZoneMapProps> = ({ parties, activeZone, onSelectZone }) => {
  const { language, t } = useLanguage();
  const isAr = language === 'ar';

  const partiesByZone = React.useMemo(() => {
    const map = new Map<PartyZone, PartyView[]>();
    for (const party of parties) {
      const list = map.get(party.zone) ?? [];
      list.push(party);
      map.set(party.zone, list);
    }
    return map;
  }, [parties]);

  const categoriesByZone = React.useMemo(() => {
    const map = new Map<PartyZone, Set<PartyCategory>>();
    for (const [zone, list] of partiesByZone) {
      map.set(zone, new Set(list.map(p => p.category)));
    }
    return map;
  }, [partiesByZone]);

  return (
    <div
      className="relative rounded-3xl overflow-hidden border border-[var(--border-subtle)] bg-[#0b1020]"
      role="group"
      aria-label={t('parties.map.groupLabel')}
    >
      <svg viewBox="0 0 100 70" className="w-full h-auto block" aria-hidden="true">
        <defs>
          <radialGradient id="zone-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sea" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0c2a4d" />
            <stop offset="100%" stopColor="#0a1b33" />
          </linearGradient>
        </defs>

        {/* Sea — the Gulf of Aqaba runs diagonally past the coast. */}
        <rect x="0" y="0" width="100" height="70" fill="#070b18" />
        <path d="M 72 0 L 100 0 L 100 70 L 34 70 C 52 58 66 44 76 26 Z" fill="url(#sea)" />
        <path
          d="M 24 62 C 38 52 52 40 64 22"
          fill="none"
          stroke="#1e3a5f"
          strokeWidth="0.6"
          strokeDasharray="1.5 1.2"
        />
        {/* Desert ridge line behind town. */}
        <path d="M 4 24 C 14 16 22 20 30 14" fill="none" stroke="#2a2035" strokeWidth="0.8" />
        <path d="M 0 40 C 8 34 16 38 24 32" fill="none" stroke="#241c2e" strokeWidth="0.7" />

        {/* Sinai label, static. */}
        <text x="6" y="6.5" fill="#6b7a99" fontSize="2.2" fontWeight="700">
          {isAr ? 'جنوب سيناء' : 'SOUTH SINAI'}
        </text>
        <text x="84" y="60" fill="#3d5a80" fontSize="2.4" fontWeight="700" transform="rotate(-32 84 60)">
          {isAr ? 'خليج العقبة' : 'GULF OF AQABA'}
        </text>

        {(Object.keys(PARTY_ZONE_INFO) as PartyZone[]).map(zoneId => {
          const info = PARTY_ZONE_INFO[zoneId];
          const pos = PARTY_ZONE_MAP_POSITIONS[zoneId];
          const zoneParties = partiesByZone.get(zoneId) ?? [];
          const count = zoneParties.length;
          const categories = [...(categoriesByZone.get(zoneId) ?? [])];
          const isActive = activeZone === zoneId;
          return (
            <g
              key={zoneId}
              transform={`translate(${pos.x}, ${pos.y})`}
              className="cursor-pointer"
              onClick={() => onSelectZone(isActive ? null : zoneId)}
            >
              {count > 0 && <circle r="9" fill="url(#zone-glow)" />}
              {/* Coast dot: the pin is the zone, category rings are the nights. */}
              {count > 0 && categories.slice(0, 4).map((cat, i) => (
                <circle
                  key={cat}
                  r={2.6 + i * 0.9}
                  fill="none"
                  stroke={PARTY_CATEGORY_COLORS[cat]}
                  strokeWidth={count > 1 && i === 0 ? 1 : 0.7}
                  opacity={0.9 - i * 0.22}
                />
              ))}
              <circle
                r={isActive ? 2.4 : 1.8}
                fill={count > 0 ? (isActive ? '#fbbf24' : '#e2e8f0') : '#475569'}
                stroke={isActive ? '#fbbf24' : 'transparent'}
                strokeWidth="0.5"
              />
              {count > 0 && (
                <text
                  x={0}
                  y={-4.6}
                  textAnchor="middle"
                  fill="#e2e8f0"
                  fontSize="2.6"
                  fontWeight="700"
                >
                  {count}
                </text>
              )}
              <text
                x={0}
                y={6.2}
                textAnchor="middle"
                fill={isActive ? '#fbbf24' : count > 0 ? '#aab6cc' : '#5b6779'}
                fontSize="2.3"
                fontWeight="600"
              >
                {isAr ? info.nameAr : info.nameEn}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Category legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 py-3 bg-black/30 border-t border-white/5">
        {(Object.keys(PARTY_CATEGORY_COLORS) as PartyCategory[]).map(cat => (
          <span key={cat} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300">
            <span
              aria-hidden="true"
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: PARTY_CATEGORY_COLORS[cat] }}
            />
            {t(`parties.category.${cat}`)}
          </span>
        ))}
      </div>
    </div>
  );
};

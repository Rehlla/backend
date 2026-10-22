import React from 'react';
import type { DestinationId } from '../../design/destinations';

/**
 * Landscape art per destination (brand board §03). Stands in wherever a
 * place has no photography yet (Nuweiba, Siwa) and in pickers, where a
 * consistent illustration reads faster than three unrelated photos.
 * Colours are fixed per place, independent of the active destination.
 */
const PALETTES: Record<DestinationId, Record<string, string>> = {
  dahab: { sky1: '#F2C9A8', sky2: '#9CD4D0', l1: '#9A5642', l2: '#6B3B2E', water: '#1F9D97', deep: '#0B151C', ground: '#E3CFAE', accent: '#0E7C7A', clay: '#B4523A' },
  nuweiba: { sky1: '#E9E4D6', sky2: '#BFDDE2', l1: '#B6A28C', l2: '#8E7C69', water: '#6FB3BF', deep: '#13232A', ground: '#E7DCC6', accent: '#2D7787', clay: '#A97447' },
  sharm: { sky1: '#DCEEF7', sky2: '#B7DCEC', l1: '#60A5FA', l2: '#3B7FB8', water: '#0EA5E9', deep: '#0A1A2A', ground: '#EADCC2', accent: '#0369A1', clay: '#B4523A' },
  hurghada: { sky1: '#F7E3C0', sky2: '#F2D49A', l1: '#FDE68A', l2: '#D9A441', water: '#38BDF8', deep: '#1A1A0A', ground: '#F2E6C8', accent: '#B45309', clay: '#A9573A' },
  marsa_alam: { sky1: '#D7F2E4', sky2: '#B6E7D1', l1: '#6EE7B7', l2: '#34B98A', water: '#10B981', deep: '#0A1F1A', ground: '#E8E2C4', accent: '#047857', clay: '#9A5642' },
  siwa: { sky1: '#F3D7A6', sky2: '#F7EBCF', l1: '#D9B583', l2: '#C29763', water: '#7FC3BD', deep: '#211C16', ground: '#EADBC0', accent: '#4A7445', clay: '#A9573A' },
  alexandria: { sky1: '#DBEAFE', sky2: '#93C5FD', l1: '#60A5FA', l2: '#2563EB', water: '#3B82F6', deep: '#0F172A', ground: '#F0F7FF', accent: '#10B981', clay: '#B45309' },
  giza: { sky1: '#FEF3C7', sky2: '#FDE68A', l1: '#F59E0B', l2: '#B45309', water: '#FBBF24', deep: '#1F1A0A', ground: '#FDF6E3', accent: '#92400E', clay: '#78350F' },
  luxor: { sky1: '#FDE68A', sky2: '#FEF3C7', l1: '#F59E0B', l2: '#D97706', water: '#FBBF24', deep: '#3F1D0A', ground: '#FBF3E3', accent: '#92400E', clay: '#78350F' },
  aswan: { sky1: '#CFFAFE', sky2: '#06B6D4', l1: '#06B6D4', l2: '#0A2A36', water: '#0EA5E9', deep: '#0A2A36', ground: '#E8F4F8', accent: '#0891B2', clay: '#0A2A36' },
  saint_catherine: { sky1: '#EDE9FE', sky2: '#7C3AED', l1: '#7C3AED', l2: '#1E1B2E', water: '#8B5CF6', deep: '#1E1B2E', ground: '#F5F3FF', accent: '#6D28D9', clay: '#1E1B2E' },
  taba: { sky1: '#CFFAFE', sky2: '#0E7490', l1: '#0E7490', l2: '#0A1F2E', water: '#0891B2', deep: '#0A1F2E', ground: '#ECFEFF', accent: '#0E7490', clay: '#0A1F2E' },
};

function Land({ id, p }: { id: DestinationId; p: Record<string, string> }) {
  if (id === 'dahab') {
    return (
      <>
        <path d="M0 300 L120 210 L210 260 L330 150 L450 250 L560 190 L700 280 L820 200 L960 270 L1080 220 L1200 260 V380 H0Z" fill={p.l1} />
        <path d="M0 340 L160 270 L300 320 L420 260 L600 330 L760 280 L900 330 L1050 290 L1200 320 V390 H0Z" fill={p.l2} />
        <rect y="370" width="1200" height="150" fill={`url(#w-${id})`} />
        <path d="M0 372 H1200" stroke="#fff" strokeOpacity=".5" strokeWidth="2" />
        <g stroke="#fff" strokeOpacity=".22" fill="none">
          <path d="M80 420 q40 -10 80 0 t80 0" />
          <path d="M600 450 q40 -10 80 0 t80 0" />
          <path d="M900 410 q40 -10 80 0 t80 0" />
        </g>
      </>
    );
  }
  if (id === 'nuweiba') {
    return (
      <>
        <path d="M0 330 L200 290 L420 310 L640 280 L900 305 L1200 285 V380 H0Z" fill={p.l1} />
        <rect y="372" width="1200" height="148" fill={`url(#w-${id})`} />
        <g stroke="#fff">
          <path d="M0 400 H1200" strokeOpacity=".35" />
          <path d="M0 430 H1200" strokeOpacity=".2" />
          <path d="M0 470 H1200" strokeOpacity=".12" />
        </g>
        <g fill={p.l2}>
          <path d="M180 372 v-46 h8 v46z" />
          <path d="M150 330 L184 300 L218 330z" />
          <path d="M262 372 v-38 h7 v38z" />
          <path d="M236 338 L266 312 L296 338z" />
        </g>
        <path d="M0 372 H1200" stroke={p.ground} strokeWidth="10" />
      </>
    );
  }
  return (
    <>
      <path d="M0 330 Q200 280 380 320 T760 300 T1200 310 V520 H0Z" fill={p.l1} />
      <ellipse cx="760" cy="410" rx="300" ry="34" fill={p.water} opacity=".9" />
      <ellipse cx="760" cy="404" rx="280" ry="22" fill="#fff" opacity=".35" />
      <path d="M0 440 Q260 400 520 450 T1200 430 V520 H0Z" fill={p.l2} />
      <g fill={p.accent}>
        <path d="M210 360 q4 -40 2 -70" stroke="#5a4532" strokeWidth="5" fill="none" />
        <path d="M212 292 q-30 -2 -46 18 q22 -10 46 -18z M212 292 q30 -4 48 14 q-24 -8 -48 -14z M212 292 q-12 -24 -36 -30 q16 14 36 30z M212 292 q14 -24 38 -28 q-18 12 -38 28z" />
        <path d="M300 372 q3 -34 1 -60" stroke="#5a4532" strokeWidth="4" fill="none" />
        <path d="M301 314 q-26 -2 -40 16 q20 -9 40 -16z M301 314 q26 -4 42 12 q-21 -7 -42 -12z M301 314 q-10 -21 -31 -26 q14 12 31 26z" />
      </g>
      <path d="M960 330 h120 v-40 h-24 v-22 h-30 v-18 h-34 v30 h-32z" fill={p.clay} opacity=".85" />
    </>
  );
}

export const DestinationScene: React.FC<{ id: DestinationId; className?: string }> = ({ id, className }) => {
  const p = PALETTES[id];
  return (
    <svg viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`s-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky2} />
          <stop offset="1" stopColor={p.sky1} />
        </linearGradient>
        <linearGradient id={`w-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.water} />
          <stop offset="1" stopColor={p.deep} />
        </linearGradient>
      </defs>
      <rect width="1200" height="520" fill={`url(#s-${id})`} />
      <circle cx="860" cy="170" r="54" fill="#fff" opacity=".55" />
      <Land id={id} p={p} />
    </svg>
  );
};

import React, { useId } from 'react';
import type { PictogramId } from '../../data/destinationEditorial';

/**
 * Dimensional category pictograms (plan §06, "3D icons with a one-shot tap
 * animation" after Airbnb 2025). Soft gradients and a gloss highlight give
 * depth without photographs; the colours are the brand materials (lagoon,
 * sand, sunset coral, granite, night) so they sit in every destination.
 * The tap animation lives with the caller (PlaceCategories).
 */

export const Pictogram: React.FC<{ id: PictogramId; className?: string }> = ({ id, className }) => {
  const u = useId().replace(/:/g, '');
  const g = (name: string) => `url(#${name}-${u})`;
  const shadow = <ellipse cx="24" cy="42" rx="14" ry="2.6" fill="#000" opacity=".18" />;

  const art: Record<PictogramId, React.ReactNode> = {
    dive: (
      <>
        {shadow}
        <rect x="7" y="13" width="34" height="20" rx="10" fill={g('sea')} />
        <rect x="11" y="17" width="11" height="12" rx="5" fill="#0B3B44" />
        <rect x="26" y="17" width="11" height="12" rx="5" fill="#0B3B44" />
        <rect x="7" y="13" width="34" height="20" rx="10" fill={g('gloss')} />
        <path d="M41 18c4 0 4 0 4-6" stroke="#F08A6C" strokeWidth="3" fill="none" strokeLinecap="round" />
      </>
    ),
    snorkel: (
      <>
        {shadow}
        <rect x="6" y="16" width="30" height="18" rx="9" fill={g('sea')} />
        <rect x="10" y="20" width="22" height="10" rx="5" fill="#0B3B44" />
        <rect x="6" y="16" width="30" height="18" rx="9" fill={g('gloss')} />
        <path d="M38 34V8a3 3 0 0 1 6 0" stroke={g('coral')} strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
    kite: (
      <>
        {shadow}
        <path d="M8 20C12 9 26 5 40 10L30 26C24 21 15 19 8 20z" fill={g('coral')} />
        <path d="M8 20C12 9 26 5 40 10L30 26C24 21 15 19 8 20z" fill={g('gloss')} />
        <path d="M30 26 24 40M8 20l16 20" stroke="#BAC3C7" strokeWidth="1.4" />
        <circle cx="24" cy="40" r="2.2" fill="#3CC2BC" />
      </>
    ),
    camel: (
      <>
        {shadow}
        <path d="M4 38c6-8 12-10 20-8s14 0 20-6v14z" fill={g('sand')} />
        <path d="M13 30c0-6 3-9 6-9 2 0 3 2 5 2s3-4 6-4c2 0 3 2 3 4v3l3 1-1 3h-3v6h-3v-6h-9v6h-3v-6z" fill={g('granite')} />
        <circle cx="36" cy="10" r="5" fill={g('coral')} />
      </>
    ),
    mountain: (
      <>
        {shadow}
        <path d="M3 40 18 14l7 10 5-6 15 22z" fill={g('granite')} />
        <path d="M3 40 18 14l7 10 5-6 15 22z" fill={g('gloss')} />
        <path d="m18 14-3 6h6z" fill="#F5F4F0" />
        <circle cx="38" cy="10" r="3" fill="#F2C46B" />
      </>
    ),
    dome: (
      <>
        {shadow}
        <path d="M6 40a18 18 0 0 1 36 0z" fill={g('sea')} />
        <path d="M6 40a18 18 0 0 1 36 0z" fill={g('gloss')} />
        <path d="M24 22v18M14 26l6 14M34 26l-6 14M8 33h32" stroke="#0B3B44" strokeWidth="1.2" opacity=".55" />
        <path d="M20 40a4 6 0 0 1 8 0z" fill="#F2C46B" />
      </>
    ),
    jeep: (
      <>
        {shadow}
        <path d="M5 30v-6l5-9h22l6 7h5v8z" fill={g('night')} />
        <path d="M12 17h8v6h-11zM22 17h9l4 6H22z" fill="#A6E3DF" />
        <path d="M5 24h38v6H5z" fill={g('gloss')} opacity=".5" />
        <circle cx="13" cy="32" r="4.5" fill="#0B151C" />
        <circle cx="13" cy="32" r="2" fill="#BAC3C7" />
        <circle cx="35" cy="32" r="4.5" fill="#0B151C" />
        <circle cx="35" cy="32" r="2" fill="#BAC3C7" />
      </>
    ),
    hut: (
      <>
        {shadow}
        <path d="M4 22 24 8l20 14z" fill={g('sand')} />
        <path d="M4 22 24 8l20 14z" fill={g('gloss')} />
        <path d="M9 22v16M39 22v16M16 22v16M32 22v16" stroke="#8E7C69" strokeWidth="2.2" />
        <path d="M4 38h40" stroke={g('sea')} strokeWidth="4" strokeLinecap="round" />
      </>
    ),
    canyon: (
      <>
        {shadow}
        <path d="M2 40V12l8 4 4-6 6 30z" fill={g('coral')} />
        <path d="M46 40V10l-7 5-5-5-6 30z" fill={g('granite')} />
        <path d="M20 40h8l-2-12h-4z" fill={g('sand')} />
        <path d="M2 40V12l8 4 4-6 6 30z" fill={g('gloss')} opacity=".6" />
      </>
    ),
    stars: (
      <>
        {shadow}
        <circle cx="24" cy="22" r="17" fill={g('night')} />
        <path d="M27 11a10 10 0 1 0 8 15 8 8 0 1 1-8-15z" fill="#F2C46B" />
        <circle cx="14" cy="15" r="1.4" fill="#ECE9E2" />
        <circle cx="16" cy="29" r="1" fill="#ECE9E2" />
        <circle cx="33" cy="13" r="1.1" fill="#ECE9E2" />
        <circle cx="24" cy="22" r="17" fill={g('gloss')} opacity=".5" />
      </>
    ),
    hammock: (
      <>
        {shadow}
        <path d="M8 40V14M40 40V14" stroke="#8E7C69" strokeWidth="3" strokeLinecap="round" />
        <path d="M8 18c6 12 26 12 32 0" stroke={g('coral')} strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M6 14c4-6 10-6 14-2M28 12c4-4 10-4 14 2" stroke="#4A7445" strokeWidth="3" fill="none" strokeLinecap="round" />
      </>
    ),
    spring: (
      <>
        {shadow}
        <ellipse cx="24" cy="32" rx="18" ry="8" fill={g('sand')} />
        <ellipse cx="24" cy="31" rx="13" ry="5" fill={g('sea')} />
        <ellipse cx="24" cy="31" rx="13" ry="5" fill={g('gloss')} />
        <path d="M18 22c0-3 2-3 2-6M24 22c0-3 2-3 2-7M30 22c0-3 2-3 2-6" stroke="#F08A6C" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".8" />
      </>
    ),
    saltlake: (
      <>
        {shadow}
        <path d="M3 34c8-6 34-6 42 0v4H3z" fill={g('sea')} />
        <path d="M10 33l4-7 4 7zM20 31l5-9 5 9zM31 33l4-6 4 6z" fill="#FBFAF7" />
        <path d="M3 34c8-6 34-6 42 0v4H3z" fill={g('gloss')} opacity=".6" />
        <circle cx="38" cy="12" r="4" fill="#F2C46B" />
      </>
    ),
    fortress: (
      <>
        {shadow}
        <path d="M6 40V26h6v-6h6v-8h10v6h8v8h6v14z" fill={g('coral')} />
        <path d="M6 40V26h6v-6h6v-8h10v6h8v8h6v14z" fill={g('gloss')} opacity=".7" />
        <path d="M15 32h3v8h-3zM24 22h3v4h-3zM31 30h3v4h-3z" fill="#5A3A2C" />
      </>
    ),
    palm: (
      <>
        {shadow}
        <path d="M24 40q2-14 0-24" stroke="#7A5A3E" strokeWidth="3.4" fill="none" strokeLinecap="round" />
        <path d="M24 16q-12-2-16 8 8-6 16-8zM24 16q12-3 16 6-8-5-16-6zM24 16q-6-8-14-8 8 3 14 8zM24 16q6-9 14-8-9 2-14 8z" fill={g('palm')} />
      </>
    ),
    food: (
      <>
        {shadow}
        <ellipse cx="24" cy="30" rx="18" ry="8" fill={g('sand')} />
        <ellipse cx="24" cy="28" rx="13" ry="5" fill="#FBFAF7" />
        <path d="M15 27c3-5 15-5 18 0z" fill={g('coral')} />
        <path d="M15 27c3-5 15-5 18 0z" fill={g('gloss')} />
        <path d="M40 8v14M37 8v6c0 2 6 2 6 0V8" stroke="#BAC3C7" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </>
    ),
    bike: (
      <>
        {shadow}
        <circle cx="13" cy="31" r="8" fill="none" stroke="#14232B" strokeWidth="3" />
        <circle cx="35" cy="31" r="8" fill="none" stroke="#14232B" strokeWidth="3" />
        <path d="M13 31l7-12h10l5 12M20 19l5 12h-12M30 19l-2-5h-4" stroke={g('sea')} strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="25" cy="31" r="2" fill={g('coral')} />
      </>
    ),
    sos: (
      <>
        {shadow}
        <circle cx="24" cy="23" r="16" fill={g('coral')} />
        <circle cx="24" cy="23" r="16" fill={g('gloss')} />
        <circle cx="24" cy="23" r="7" fill="#FBFAF7" />
        <path d="M24 7v9M24 30v9M8 23h9M31 23h9" stroke="#FBFAF7" strokeWidth="3.4" />
      </>
    ),
    lotus: (
      <>
        {shadow}
        <path d="M24 34c-6-4-8-12-0-22 8 10 6 18 0 22z" fill={g('coral')} />
        <path d="M24 34c-8 0-16-4-18-12 8-2 14 2 18 12zM24 34c8 0 16-4 18-12-8-2-14 2-18 12z" fill={g('palm')} />
        <path d="M24 34c-6-4-8-12 0-22 8 10 6 18 0 22z" fill={g('gloss')} opacity=".6" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`sea-${u}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7FE0DA" /><stop offset="1" stopColor="#138C88" /></linearGradient>
        <linearGradient id={`sand-${u}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F3DDB6" /><stop offset="1" stopColor="#C79A5B" /></linearGradient>
        <linearGradient id={`coral-${u}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFB49B" /><stop offset="1" stopColor="#D0573A" /></linearGradient>
        <linearGradient id={`granite-${u}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C58E79" /><stop offset="1" stopColor="#7A4B3D" /></linearGradient>
        <linearGradient id={`night-${u}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3E5866" /><stop offset="1" stopColor="#14232B" /></linearGradient>
        <linearGradient id={`palm-${u}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A8C99A" /><stop offset="1" stopColor="#4A7445" /></linearGradient>
        <radialGradient id={`gloss-${u}`} cx=".35" cy=".25" r=".6"><stop offset="0" stopColor="#fff" stopOpacity=".7" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      {art[id]}
    </svg>
  );
};

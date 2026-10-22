import React from 'react';

export type DahabMotifName =
  | 'wave-divider'
  | 'topo-contour'
  | 'sun-arc'
  | 'route-path'
  | 'compass-rose'
  | 'reef-art'
  | 'footprint';

export interface DahabMotifProps {
  name: DahabMotifName;
  className?: string;
  size?: number | string;
  strokeWidth?: number;
}

/**
 * DAHAB VISUAL LANGUAGE SYSTEM
 * 7 Signature "Dahab Objects" & Vector Motifs
 */
export const DahabMotif: React.FC<DahabMotifProps> = ({
  name,
  className = '',
  size = 24,
  strokeWidth = 1.5,
}) => {
  switch (name) {
    case 'wave-divider':
      return (
        <div className={`w-full flex items-center justify-center overflow-hidden py-2 ${className}`}>
          <svg
            viewBox="0 0 1200 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full max-w-4xl h-4 text-current opacity-40"
            preserveAspectRatio="none"
          >
            <path
              d="M0 12 Q 75 0, 150 12 T 300 12 T 450 12 T 600 12 T 750 12 T 900 12 T 1050 12 T 1200 12"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            <circle cx="600" cy="12" r="3" fill="currentColor" />
          </svg>
        </div>
      );

    case 'topo-contour':
      return (
        <svg
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`w-full h-full pointer-events-none ${className}`}
        >
          <path
            d="M 50 200 C 70 120, 180 80, 260 110 C 340 140, 370 230, 320 310 C 270 380, 150 360, 100 300 Z"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray="4 4"
            opacity="0.25"
          />
          <path
            d="M 90 200 C 110 140, 190 110, 250 130 C 310 150, 330 220, 290 280 C 250 330, 170 320, 130 270 Z"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            opacity="0.35"
          />
          <path
            d="M 130 200 C 150 160, 200 140, 240 160 C 280 180, 290 220, 260 250 C 230 280, 180 280, 150 240 Z"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            opacity="0.5"
          />
        </svg>
      );

    case 'sun-arc':
      return (
        <svg
          viewBox="0 0 120 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: size, height: typeof size === 'number' ? size / 2 : 'auto' }}
          className={`inline-block ${className}`}
        >
          {/* Base horizon */}
          <path d="M0 60H120" stroke="currentColor" strokeWidth={strokeWidth} opacity="0.4" />
          {/* Solar semi-circle arc */}
          <path
            d="M10 60C10 32.3858 32.3858 10 60 10C87.6142 10 110 32.3858 110 60"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray="3 3"
          />
          {/* Sun disc at apex */}
          <circle cx="60" cy="10" r="5" fill="currentColor" />
          {/* Gentle rays */}
          <path d="M60 0V5M25 25L28 28M95 25L92 28" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
        </svg>
      );

    case 'route-path':
      return (
        <svg
          viewBox="0 0 200 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`w-full h-8 ${className}`}
        >
          <path
            d="M 10 20 Q 55 5, 100 20 T 190 20"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          <circle cx="10" cy="20" r="4" fill="currentColor" />
          <circle cx="100" cy="20" r="3" fill="currentColor" opacity="0.6" />
          <circle cx="190" cy="20" r="4" fill="currentColor" />
        </svg>
      );

    case 'compass-rose':
      return (
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: size, height: size }}
          className={`inline-block ${className}`}
        >
          <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth={strokeWidth} opacity="0.4" />
          <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth={strokeWidth * 0.75} strokeDasharray="2 2" opacity="0.6" />
          {/* 4 Cardinal needles */}
          <polygon points="24,4 27,24 24,21 21,24" fill="currentColor" />
          <polygon points="24,44 27,24 24,27 21,24" fill="currentColor" opacity="0.3" />
          <polygon points="44,24 24,27 27,24 24,21" fill="currentColor" opacity="0.5" />
          <polygon points="4,24 24,27 21,24 24,21" fill="currentColor" opacity="0.5" />
        </svg>
      );

    case 'reef-art':
      return (
        <svg
          viewBox="0 0 100 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: size, height: typeof size === 'number' ? size * 0.8 : 'auto' }}
          className={`inline-block ${className}`}
        >
          <path
            d="M10 75C20 60 25 45 40 45C55 45 60 65 75 55C85 45 90 60 95 75"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <path
            d="M30 45C30 25 45 15 60 15C75 15 80 35 80 50"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <circle cx="45" cy="30" r="2" fill="currentColor" opacity="0.6" />
          <circle cx="65" cy="25" r="2.5" fill="currentColor" opacity="0.6" />
          <circle cx="75" cy="40" r="1.5" fill="currentColor" opacity="0.6" />
        </svg>
      );

    case 'footprint':
    default:
      return (
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: size, height: size }}
          className={`inline-block ${className}`}
        >
          {/* Bedouin sand footprint */}
          <ellipse cx="16" cy="18" rx="6" ry="9" stroke="currentColor" strokeWidth={strokeWidth} />
          <circle cx="16" cy="6" r="2.5" fill="currentColor" />
          <circle cx="11" cy="8" r="1.5" fill="currentColor" />
          <circle cx="21" cy="8" r="1.5" fill="currentColor" />
        </svg>
      );
  }
};

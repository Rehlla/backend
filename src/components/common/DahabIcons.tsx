import React from 'react';

export type DahabIconName =
  | 'diver'
  | 'fin'
  | 'reef'
  | 'mountain'
  | 'sun'
  | 'wind'
  | 'camel'
  | 'scooter'
  | 'food'
  | 'coffee'
  | 'luggage'
  | 'transfer'
  | 'compass'
  | 'wave';

export interface DahabIconProps extends React.SVGProps<SVGSVGElement> {
  name: DahabIconName;
  size?: number;
  className?: string;
  accent?: boolean;
}

/**
 * DAHAB VISUAL LANGUAGE SYSTEM
 * Bespoke Handcrafted Sinai & Red Sea Vector Iconography
 * 24x24 Coordinate Grid · 1.75px–2.0px Consistent Stroke · Rounded Joins
 */
export const DahabIcon: React.FC<DahabIconProps> = ({
  name,
  size = 24,
  className = '',
  accent = false,
  ...props
}) => {
  const baseAttrs = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    className: `inline-block flex-shrink-0 transition-transform ${className}`,
    ...props,
  };

  switch (name) {
    case 'diver':
      return (
        <svg {...baseAttrs}>
          {/* Diver head / mask */}
          <circle cx="18" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.75" />
          {/* Dive mask glass */}
          <path d="M19 5.5H20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          {/* Torso & tank */}
          <rect
            x="7"
            y="7"
            width="5"
            height="10"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.75"
            fill={accent ? 'currentColor' : 'none'}
            fillOpacity={accent ? 0.2 : 0}
          />
          {/* Streamlined body & legs */}
          <path
            d="M16 8.5L12 11L7 13.5L3 17"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Fin blade */}
          <path
            d="M3 17L1.5 21L5 19.5L3 17Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
            fill={accent ? 'currentColor' : 'none'}
            fillOpacity={accent ? 0.3 : 0}
          />
        </svg>
      );

    case 'fin':
      return (
        <svg {...baseAttrs}>
          {/* Foot pocket */}
          <path
            d="M17 4C17 2.89543 15.8954 2 14.5 2C13.1046 2 12 2.89543 12 4V8H17V4Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          {/* Long freediving blade */}
          <path
            d="M12 8L7 21C7 21 11 22.5 15 22.5C19 22.5 21 21 21 21L17 8H12Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
            fill={accent ? 'currentColor' : 'none'}
            fillOpacity={accent ? 0.15 : 0}
          />
          {/* Hydrodynamic rib */}
          <path d="M14.5 8V19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'reef':
      return (
        <svg {...baseAttrs}>
          {/* Table coral structure */}
          <path
            d="M3 19C4.5 16 6 15 8 15C10 15 11 17 13 17C15 17 16 14 18 14C20 14 21.5 16 22 19"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            d="M6 15C6 11 8 8 12 8C16 8 18 11 18 14"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            d="M12 8V4M10 5L12 4L14 5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="11" r="1" fill="currentColor" />
          <circle cx="15" cy="11" r="1" fill="currentColor" />
          <path d="M2 21H22" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );

    case 'mountain':
      return (
        <svg {...baseAttrs}>
          {/* Primary Sinai Granite Peak */}
          <path
            d="M2 20L9.5 7L14 14L17.5 9L22 20H2Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={accent ? 'currentColor' : 'none'}
            fillOpacity={accent ? 0.15 : 0}
          />
          {/* Geological strata fissures */}
          <path
            d="M9.5 7V13L13 18"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M17.5 9V14L19.5 18"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'sun':
      return (
        <svg {...baseAttrs}>
          {/* Sun disc */}
          <circle
            cx="12"
            cy="12"
            r="4.5"
            stroke="currentColor"
            strokeWidth="1.75"
            fill={accent ? 'currentColor' : 'none'}
            fillOpacity={accent ? 0.2 : 0}
          />
          {/* Solar rays */}
          <path d="M12 2V4.5M12 19.5V22" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M2 12H4.5M19.5 12H22" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M4.93 4.93L6.7 6.7M17.3 17.3L19.07 19.07" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M4.93 19.07L6.7 17.3M17.3 6.7L19.07 4.93" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );

    case 'wind':
      return (
        <svg {...baseAttrs}>
          {/* Top wind streamline */}
          <path
            d="M3 8H15.5C17.433 8 19 6.433 19 4.5C19 2.567 17.433 1 15.5 1C13.567 1 12 2.567 12 4.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          {/* Mid main wind streamline with arrow */}
          <path
            d="M2 13H18.5C20.433 13 22 14.567 22 16.5C22 18.433 20.433 20 18.5 20C16.567 20 15 18.433 15 16.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          {/* Lower breeze */}
          <path d="M4 18H11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );

    case 'camel':
      return (
        <svg {...baseAttrs}>
          {/* Camel head and neck */}
          <path
            d="M4 6H7L8 10L10 10C11.5 7 13.5 7 15 10L18 10L20 12V18M4 6V9"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Camel legs */}
          <path d="M8 17V22M10 17V22M17 18V22M19 18V22" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          {/* Saddle blanket */}
          <path
            d="M11 11H15V14H11V11Z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill={accent ? 'currentColor' : 'none'}
            fillOpacity={accent ? 0.25 : 0}
          />
        </svg>
      );

    case 'scooter':
      return (
        <svg {...baseAttrs}>
          {/* Front wheel */}
          <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.75" />
          {/* Rear wheel */}
          <circle cx="18" cy="18" r="3" stroke="currentColor" strokeWidth="1.75" />
          {/* Scooter frame & handlebars */}
          <path
            d="M6 18L9 9H13L15 15H18M9 9L8 5H6M8 5H10"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Seat */}
          <path d="M12 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'food':
      return (
        <svg {...baseAttrs}>
          {/* Whole Red Sea fish shape */}
          <path
            d="M2 12C5 8 13 7 18 10L22 7V17L18 14C13 17 5 16 2 12Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
            fill={accent ? 'currentColor' : 'none'}
            fillOpacity={accent ? 0.15 : 0}
          />
          <circle cx="6" cy="11" r="1" fill="currentColor" />
          {/* Grill marks */}
          <path d="M10 9.5V14.5M13 9.5V14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'coffee':
      return (
        <svg {...baseAttrs}>
          {/* Glass tea/coffee cup */}
          <path
            d="M4 7H18V14C18 17.3137 15.3137 20 12 20C8.68629 20 6 17.3137 6 14L4 7Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
            fill={accent ? 'currentColor' : 'none'}
            fillOpacity={accent ? 0.15 : 0}
          />
          <path
            d="M18 9H19.5C20.8807 9 22 10.1193 22 11.5C22 12.8807 20.8807 14 19.5 14H18"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          {/* Steam / mint sprig */}
          <path d="M9 2C9 4 11 4 11 6M13 2C13 4 15 4 15 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M3 21H21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );

    case 'luggage':
      return (
        <svg {...baseAttrs}>
          {/* Expedition backpack */}
          <rect
            x="6"
            y="7"
            width="12"
            height="14"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.75"
            fill={accent ? 'currentColor' : 'none'}
            fillOpacity={accent ? 0.15 : 0}
          />
          {/* Top handle */}
          <path d="M9 7V4C9 3.44772 9.44772 3 10 3H14C14.5523 3 15 3.44772 15 4V7" stroke="currentColor" strokeWidth="1.75" />
          {/* Straps and front pocket */}
          <path d="M6 13H18" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9" y="14" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );

    case 'transfer':
      return (
        <svg {...baseAttrs}>
          {/* 4x4 / Safari van silhouette */}
          <path
            d="M3 15V10C3 9.44772 3.44772 9 4 9H14L18 12H21C21.5523 12 22 12.4477 22 13V15M3 15H6M22 15H19"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.75" />
          <circle cx="17" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.75" />
          <path d="M14 9V12H18" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );

    case 'compass':
      return (
        <svg {...baseAttrs}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
          {/* Needle */}
          <polygon
            points="12,6 15,12 12,11 9,12"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="currentColor"
          />
          <polygon
            points="12,18 15,12 12,13 9,12"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      );

    case 'wave':
    default:
      return (
        <svg {...baseAttrs}>
          <path
            d="M2 12C5 9 7 9 10 12C13 15 15 15 18 12C19.5 10.5 21 10.5 22 12"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            d="M2 17C5 14 7 14 10 17C13 20 15 20 18 17C19.5 15.5 21 15.5 22 17"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            opacity="0.6"
          />
        </svg>
      );
  }
};

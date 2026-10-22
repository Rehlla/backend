import React from 'react';

interface CmsImageProps {
  src: string;
  alt: string;
  /** Focal point for the crop, 0–100 on each axis (50/50 = center). */
  focalX?: number;
  focalY?: number;
  /** Responsive siblings (`url widthw, …`) from the media library meta. */
  srcSet?: string;
  /** Width hints for srcset selection (defaults to full width). */
  sizes?: string;
  /** Above-the-fold heroes should pass "high". */
  fetchPriority?: 'high' | 'low' | 'auto';
  className?: string;
  loading?: 'lazy' | 'eager';
  style?: React.CSSProperties;
  onClick?: () => void;
}

function clampAxis(value: number | undefined): number {
  if (!Number.isFinite(value as number)) return 50;
  return Math.min(100, Math.max(0, Math.round(value as number)));
}

/**
 * CMS-aware image: honors the library focal point via object-position so
 * editor-chosen crops survive every aspect ratio the layout imposes, and
 * serves responsive variants via srcset when the library provides them.
 */
export const CmsImage: React.FC<CmsImageProps> = ({
  src,
  alt,
  focalX = 50,
  focalY = 50,
  srcSet,
  sizes = '100vw',
  fetchPriority = 'auto',
  className,
  loading = 'lazy',
  style,
  onClick,
}) => (
  <img
    src={src}
    alt={alt}
    loading={loading}
    decoding="async"
    fetchPriority={fetchPriority}
    onClick={onClick}
    className={className}
    {...(srcSet ? { srcSet, sizes } : {})}
    style={{ objectPosition: `${clampAxis(focalX)}% ${clampAxis(focalY)}%`, ...style }}
  />
);

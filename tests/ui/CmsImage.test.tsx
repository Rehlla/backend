import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { CmsImage } from '../../src/components/common/CmsImage';

// vitest runs without globals here, so Testing Library's auto-cleanup is
// not registered — do it explicitly or DOM nodes leak between tests.
afterEach(() => cleanup());

describe('CmsImage', () => {
  it('renders srcset/sizes when responsive siblings exist', () => {
    render(
      <CmsImage
        src="/api/media/big.jpg"
        alt="Sea view"
        srcSet="/api/media/big-w400.jpg 400w, /api/media/big-w800.jpg 800w"
        sizes="(max-width: 768px) 100vw, 66vw"
      />
    );
    const img = screen.getByAltText('Sea view') as HTMLImageElement;
    expect(img.getAttribute('srcset')).toBe('/api/media/big-w400.jpg 400w, /api/media/big-w800.jpg 800w');
    expect(img.getAttribute('sizes')).toBe('(max-width: 768px) 100vw, 66vw');
    // Focal crop survives via object-position, centered by default.
    expect(img.style.objectPosition).toBe('50% 50%');
  });

  it('omits srcset/sizes for single-file assets and honors the focal point', () => {
    render(<CmsImage src="/api/media/one.jpg" alt="One" focalX={20} focalY={80} />);
    const img = screen.getByAltText('One') as HTMLImageElement;
    expect(img.hasAttribute('srcset')).toBe(false);
    expect(img.hasAttribute('sizes')).toBe(false);
    expect(img.style.objectPosition).toBe('20% 80%');
  });

  it('clamps out-of-range focal axes instead of emitting invalid CSS', () => {
    render(<CmsImage src="/api/media/x.jpg" alt="X" focalX={500} focalY={-30} />);
    const img = screen.getByAltText('X') as HTMLImageElement;
    expect(img.style.objectPosition).toBe('100% 0%');
  });
});

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { LanguageProvider } from '../../src/i18n/LanguageContext';
import { BookingTimeline } from '../../src/components/bookings/BookingTimeline';

// vitest runs without globals here, so Testing Library's auto-cleanup is
// not registered — do it explicitly or DOM nodes leak between tests.
afterEach(() => cleanup());

function renderTimeline(supplierState: string, refunded = false) {
  return render(
    <LanguageProvider>
      <BookingTimeline supplierState={supplierState} refunded={refunded} />
    </LanguageProvider>
  );
}

describe('BookingTimeline', () => {
  it('renders four localized steps with the current one marked', () => {
    renderTimeline('CONFIRMED');
    expect(screen.getByText('Requested')).toBeTruthy();
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.getByText('In service')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    const current = screen.getByText('Confirmed').closest('li')?.querySelector('[aria-current="step"]');
    expect(current).toBeTruthy();
  });

  it('renders a terminal verdict for completed bookings', () => {
    renderTimeline('COMPLETED');
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.queryByText('Requested')).toBeNull();
  });

  it('renders the refund verdict when money went back', () => {
    renderTimeline('CONFIRMED', true);
    expect(screen.getByText('Refunded')).toBeTruthy();
  });

  it('exposes the stepper as an accessible list', () => {
    const { container } = renderTimeline('EN_ROUTE');
    const list = container.querySelector('ol');
    expect(list).toBeTruthy();
    expect(list?.querySelectorAll('li').length).toBe(4);
  });
});

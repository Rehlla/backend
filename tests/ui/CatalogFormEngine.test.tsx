import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { useState } from 'react';
import { LanguageProvider } from '../../src/i18n/LanguageContext';
import { api } from '../../src/services/api';
import { FormEngine } from '../../src/components/operations/command-center/catalog/FormEngine';
import { CreateWizard, wizardSteps } from '../../src/components/operations/command-center/catalog/CreateWizard';
import { RateCalendar } from '../../src/components/operations/command-center/catalog/RateCalendar';
import { missingFields, isPriceJump, bodyFromValues } from '../../src/components/operations/command-center/catalog/catalogShared';
import type { CatalogEnvelope, CatalogFieldKind, CatalogTypeSchema } from '../../src/types/catalog';

// vitest runs without globals here, so Testing Library's auto-cleanup is
// not registered — do it explicitly or DOM nodes leak between tests.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(api, 'getCommerceSuppliers').mockResolvedValue({
    suppliers: [{ id: 'SUP-1', businessName: 'Blue Hole Divers', status: 'Active', phone: '', email: '' }],
  } as any);
});

const ALL_KINDS: CatalogFieldKind[] = [
  'text', 'i18nText', 'i18nTextarea', 'number', 'money', 'boolean', 'select', 'multiselect', 'tags',
  'time', 'timeList', 'duration', 'geo', 'gallery', 'supplier', 'dayPlan', 'json',
];

const sampleSchema: CatalogTypeSchema = {
  type: 'activity',
  label: { en: 'Activities', ar: 'الأنشطة' },
  sections: [
    {
      key: 'basics',
      label: { en: 'Basics', ar: 'الأساسيات' },
      fields: ALL_KINDS.filter(k => k !== 'gallery' && k !== 'money').map(kind => ({
        key: kind === 'i18nText' ? 'title' : `f_${kind}`,
        kind,
        required: kind === 'i18nText',
        label: { en: `Field ${kind}`, ar: `حقل ${kind}` },
        ...(kind === 'select' || kind === 'multiselect' ? { options: [{ value: 'a', label: { en: 'Option A', ar: 'أ' } }, { value: 'b' }] } : {}),
        ...(kind === 'tags' ? { suggestions: ['wifi', 'pool'] } : {}),
      })),
    },
    { key: 'media', fields: [{ key: 'images', kind: 'gallery', min: 1, max: 10 }] },
    { key: 'pricing', fields: [{ key: 'priceFromEGP', kind: 'money', required: true }] },
  ],
};

function Harness({ initial = {} }: { initial?: Record<string, unknown> }) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  return (
    <LanguageProvider>
      <FormEngine sections={sampleSchema.sections} values={values} scope="staff" onChange={(k, v) => setValues(p => ({ ...p, [k]: v }))} />
      <output data-testid="values">{JSON.stringify(values)}</output>
    </LanguageProvider>
  );
}

function envelope(over: Partial<CatalogEnvelope> = {}): CatalogEnvelope {
  return {
    id: 'X-1', type: 'hotel', status: 'draft', supplierId: null, supplierName: null,
    title: { en: 'Room', ar: 'غرفة' }, summary: { en: '', ar: '' }, coverImage: null, images: [],
    priceFromEGP: 0, fields: {}, updatedAt: '2026-10-01T00:00:00.000Z', updatedBy: null, completeness: 0,
    ...over,
  };
}

describe('FormEngine', () => {
  it('renders a control for every field kind in the contract', () => {
    const { container } = render(<Harness />);
    for (const kind of ALL_KINDS) {
      expect(container.querySelector(`[data-field-kind="${kind}"]`), kind).not.toBeNull();
    }
    // i18n kinds render the AR/EN pair side by side.
    const title = screen.getByTestId('field-title');
    expect(within(title).getByLabelText('English')).toBeTruthy();
    expect(within(title).getByLabelText('Arabic')).toBeTruthy();
    // select options come from the schema
    expect(screen.getByRole('option', { name: 'Option A' })).toBeTruthy();
  });

  it('highlights the language still missing', () => {
    render(<Harness initial={{ title: { en: 'Reef dive', ar: '' } }} />);
    const title = screen.getByTestId('field-title');
    expect(title.querySelector('[data-lang="ar"][data-missing="true"]')).not.toBeNull();
    expect(title.querySelector('[data-lang="en"][data-missing="true"]')).toBeNull();
    expect(within(title).getByText('Arabic missing')).toBeTruthy();
  });

  it('reports typed values by field key', () => {
    render(<Harness />);
    fireEvent.change(within(screen.getByTestId('field-title')).getByLabelText('English'), { target: { value: 'Snorkel' } });
    const tags = within(screen.getByTestId('field-f_tags')).getByPlaceholderText('Type and press Enter');
    fireEvent.change(tags, { target: { value: 'reef' } });
    fireEvent.keyDown(tags, { key: 'Enter' });
    const values = JSON.parse(screen.getByTestId('values').textContent || '{}');
    expect(values.title).toEqual({ en: 'Snorkel', ar: '' });
    expect(values.f_tags).toEqual(['reef']);
  });
});

describe('catalogue helpers', () => {
  it('requires both languages, the gallery minimum and a positive price', () => {
    const missing = missingFields(sampleSchema.sections, { title: { en: 'A', ar: '' }, images: [], priceFromEGP: 0 }).map(f => f.key);
    expect(missing).toEqual(['title', 'images', 'priceFromEGP']);
    expect(missingFields(sampleSchema.sections, { title: { en: 'A', ar: 'ب' }, images: ['/api/media/1'], priceFromEGP: 900 })).toEqual([]);
  });

  it('flags price changes over 30% and splits envelope keys from fields', () => {
    expect(isPriceJump(1000, 1300)).toBe(false);
    expect(isPriceJump(1000, 1301)).toBe(true);
    expect(isPriceJump(0, 5000)).toBe(false);
    expect(bodyFromValues({ title: { en: 'a', ar: 'b' }, images: ['x'], area: 'lighthouse' })).toEqual({
      title: { en: 'a', ar: 'b' }, images: ['x'], fields: { area: 'lighthouse' },
    });
  });

  it('puts gallery sections on the photos step and pricing on the last step', () => {
    const [basics, photos, price] = wizardSteps(sampleSchema);
    expect(basics.map(s => s.key)).toEqual(['basics']);
    expect(photos.map(s => s.key)).toEqual(['media']);
    expect(price.map(s => s.key)).toEqual(['pricing']);
  });
});

describe('CreateWizard', () => {
  const simple: CatalogTypeSchema = {
    type: 'activity',
    label: { en: 'Activities', ar: 'الأنشطة' },
    sections: [{ key: 'basics', fields: [{ key: 'title', kind: 'i18nText', required: true, label: { en: 'Title', ar: 'العنوان' } }] }],
  };

  it('keeps Publish disabled and lists what is missing until the record is complete', () => {
    render(
      <LanguageProvider>
        <CreateWizard scope="staff" schema={simple} canPublish onDone={() => {}} />
      </LanguageProvider>
    );
    const publish = screen.getByRole('button', { name: /^Publish$/ });
    expect((publish as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('catalog-missing').textContent).toContain('Title');

    const field = screen.getByTestId('field-title');
    fireEvent.change(within(field).getByLabelText('English'), { target: { value: 'Night dive' } });
    expect((screen.getByRole('button', { name: /^Publish$/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(field).getByLabelText('Arabic'), { target: { value: 'غوص ليلي' } });
    expect((screen.getByRole('button', { name: /^Publish$/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('catalog-missing')).toBeNull();
  });

  it('a supplier submits for review instead of publishing', () => {
    render(
      <LanguageProvider>
        <CreateWizard scope="supplier" schema={simple} canPublish={false} onDone={() => {}} />
      </LanguageProvider>
    );
    expect(screen.queryByRole('button', { name: /^Publish$/ })).toBeNull();
    expect((screen.getByRole('button', { name: /Submit for review/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('RateCalendar', () => {
  it('drag-selects a range and closes exactly those nights', async () => {
    const getRates = vi.spyOn(api, 'catalogGetRates').mockResolvedValue({
      nights: [{ date: '2026-11-04', roomId: 'R-1', nightlyEGP: 2400, closed: false }],
    });
    const putRates = vi.spyOn(api, 'catalogPutRates').mockResolvedValue({ applied: 0, queuedForApproval: false });

    render(
      <LanguageProvider>
        <RateCalendar scope="staff" hotelId="H-1" rooms={[envelope({ id: 'R-1', type: 'hotel-room' })]} initialMonth="2026-11" />
      </LanguageProvider>
    );
    await waitFor(() => expect(getRates).toHaveBeenCalledWith('staff', 'H-1', { roomId: 'R-1', from: '2026-11-01', to: '2026-11-30' }, expect.anything()));

    const cell = (d: string) => document.querySelector(`[data-date="${d}"]`) as HTMLElement;
    fireEvent.mouseDown(cell('2026-11-03'));
    fireEvent.mouseEnter(cell('2026-11-06'));
    fireEvent.mouseUp(cell('2026-11-06'));

    const selected = Array.from(document.querySelectorAll('[role="gridcell"][aria-selected="true"]')).map(e => e.getAttribute('data-date'));
    expect(selected).toEqual(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
    expect(screen.getByTestId('rate-selection').textContent).toContain('4 days');

    // Dragging backwards orders the range.
    fireEvent.mouseDown(cell('2026-11-10'));
    fireEvent.mouseEnter(cell('2026-11-08'));
    fireEvent.mouseUp(cell('2026-11-08'));
    expect(screen.getByTestId('rate-selection').textContent).toContain('2026-11-08');

    fireEvent.click(screen.getByRole('button', { name: /Close dates/ }));
    await waitFor(() => expect(putRates).toHaveBeenCalledWith('staff', 'H-1', { roomId: 'R-1', from: '2026-11-08', to: '2026-11-10', closed: true }));
  });

  it('asks for a reason when the new price is more than 30% away', async () => {
    vi.spyOn(api, 'catalogGetRates').mockResolvedValue({ nights: [{ date: '2026-11-04', roomId: 'R-1', nightlyEGP: 1000, closed: false }] });
    const putRates = vi.spyOn(api, 'catalogPutRates').mockResolvedValue({ applied: 0, queuedForApproval: false });
    render(
      <LanguageProvider>
        <RateCalendar scope="staff" hotelId="H-1" rooms={[envelope({ id: 'R-1' })]} initialMonth="2026-11" />
      </LanguageProvider>
    );
    await waitFor(() => expect(document.querySelector('[data-date="2026-11-04"]')?.textContent).toContain('1,000'));
    const cell = document.querySelector('[data-date="2026-11-04"]') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.mouseUp(cell);
    fireEvent.change(screen.getByLabelText('Nightly price'), { target: { value: '2000' } });
    fireEvent.click(screen.getByRole('button', { name: /Set price/ }));
    expect(screen.getByRole('dialog', { name: 'Price change over 30%' })).toBeTruthy();
    expect(putRates).not.toHaveBeenCalled();
  });
});

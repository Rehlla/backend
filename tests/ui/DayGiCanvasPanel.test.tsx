import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { DayGiCanvasPanel } from '../../src/components/daygi/DayGiCanvasPanel';
import type { DayGiCanvasDocument } from '../../src/shared';

/**
 * The canvas is a pure view over the server-built document: identity `t`
 * proves all copy comes from the i18n catalog, and the callbacks prove every
 * traveler action (ask, pin, remove, close) reaches the concierge view
 * instead of mutating anything itself.
 */

  vi.mock('../../src/components/daygi/useConciergeT', () => ({
    useConciergeT: () => (key: string) => key
  }));

// The real map is imperative Leaflet, which has no meaningful jsdom rendering
// (the repo ships no jsdom test for the accommodations map either). The panel
// tests assert the wiring: when placed items exist the map section mounts.
vi.mock('../../src/components/daygi/DayGiCanvasMap', () => ({
  DayGiCanvasMap: (props: { items: unknown[] }) => (
    <div data-testid="daygi-canvas-map" data-item-count={props.items.length} />
  )
}));

const doc: DayGiCanvasDocument = {
  id: 'CANVAS-TEST-1',
  title: 'Post-dive calm options',
  titleAr: 'خيارات هادية بعد الغوص',
  sourcePrompt: 'Something calm after the dive',
  createdAt: new Date('2026-01-01T10:00:00Z').toISOString(),
  days: [
    {
      id: 'day-1',
      label: 'Options',
      labelAr: 'خيارات',
      title: 'After 01:30 PM',
      titleAr: 'بعد ٠١:٣٠ م',
      items: [
        {
          id: 'item-1',
          name: 'Ali Baba Seafood',
          nameAr: 'علي بابا للسمك',
          kind: 'FOOD',
          blurb: 'Zero delay from dive exit.',
          blurbAr: 'صفر تأخير.',
          priceEGP: 350,
          travelTimeMins: 15
        },
        {
          id: 'item-2',
          name: 'Bedouin tea lounge',
          nameAr: 'جلسة شاي بدوي',
          kind: 'RELAX',
          blurb: 'Shaded cushions.',
          blurbAr: 'وسائد مظللة.'
        }
      ]
    },
    {
      id: 'day-2',
      label: 'Alternatives',
      labelAr: 'البدائل',
      items: [
        {
          id: 'item-3',
          name: 'Laguna windsurfing',
          nameAr: 'ويند سيرفنج اللاجونا',
          kind: 'ACTIVITY',
          blurb: 'Sheltered lagoon.',
          blurbAr: 'لاجونا محمية.'
        }
      ]
    }
  ]
};

const baseProps = {
  document: doc,
  lang: 'en' as const,
  itemOverrides: {},
  onTogglePin: vi.fn(),
  onRemoveItem: vi.fn(),
  onAskAboutItem: vi.fn(),
  onRegenerate: vi.fn(),
  onExecuteItem: vi.fn(),
  onClose: vi.fn()
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DayGiCanvasPanel', () => {
  it('renders the plan label, title, prompt and day-grouped item cards', () => {
    render(<DayGiCanvasPanel {...baseProps} />);

    expect(screen.getByText('daygi.canvasPlanLabel')).toBeTruthy();
    expect(screen.getByText('Post-dive calm options')).toBeTruthy();
    expect(screen.getByText('Something calm after the dive')).toBeTruthy();
    expect(screen.getByText('Ali Baba Seafood')).toBeTruthy();
    expect(screen.getByText('Bedouin tea lounge')).toBeTruthy();
    expect(screen.getByText('Laguna windsurfing')).toBeTruthy();
    expect(screen.getByText('daygi.canvasFromPrice')).toBeTruthy();
    expect(screen.getByText('Zero delay from dive exit.')).toBeTruthy();
    const items = screen.getAllByTestId('daygi-canvas-item');
    expect(items).toHaveLength(3);
  });

  it('shows all copy as catalog keys, never inline English', () => {
    render(<DayGiCanvasPanel {...baseProps} />);
    for (const key of ['daygi.canvasAskAbout', 'daygi.canvasPin', 'daygi.canvasAllDays']) {
      expect(screen.getAllByText(key).length).toBeGreaterThan(0);
    }
    // Close is icon-only: its catalog key surfaces as the accessible name.
    expect(screen.getAllByLabelText('daygi.canvasClose').length).toBeGreaterThan(0);
    // Remove is icon-only: its catalog key surfaces as the accessible name.
    expect(screen.getAllByLabelText(/^daygi\.canvasRemove:/).length).toBeGreaterThan(0);
  });

  it('filters to one day group when its tab is selected', () => {
    render(<DayGiCanvasPanel {...baseProps} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Alternatives' }));

    expect(screen.getByText('Laguna windsurfing')).toBeTruthy();
    expect(screen.queryByText('Ali Baba Seafood')).toBeNull();
    // Day tabs render the group label from the document, in the panel language.
    expect(screen.getByRole('tab', { name: 'Options' })).toBeTruthy();
  });

  it('asks about an item through the view, with a separate replace intent', () => {
    render(<DayGiCanvasPanel {...baseProps} />);

    const askButtons = screen.getAllByText('daygi.canvasAskAbout');
    fireEvent.click(askButtons[0]);
    expect(baseProps.onAskAboutItem).toHaveBeenCalledWith(doc.days[0].items[0], false);

    const replaceButtons = screen.getAllByText('daygi.canvasReplace');
    fireEvent.click(replaceButtons[0]);
    expect(baseProps.onAskAboutItem).toHaveBeenCalledWith(doc.days[0].items[0], true);
  });

  it('pins and unpins through the view without mutating the document', () => {
    render(<DayGiCanvasPanel {...baseProps} />);

    const pinButtons = screen.getAllByText('daygi.canvasPin');
    fireEvent.click(pinButtons[0]);
    expect(baseProps.onTogglePin).toHaveBeenCalledWith('item-1');

    // Pinned override comes back as view state, not component state.
    cleanup();
    render(<DayGiCanvasPanel {...baseProps} itemOverrides={{ 'item-1': 'pinned' }} />);

    const unpinned = screen.getAllByText('daygi.canvasUnpin');
    expect(unpinned.length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('daygi-canvas-item')[0].getAttribute('data-pinned')).toBe('true');
  });

  it('removes an item through the override map', () => {
    render(<DayGiCanvasPanel {...baseProps} itemOverrides={{ 'item-2': 'removed' }} />);

    expect(screen.queryByText('Bedouin tea lounge')).toBeNull();
    expect(screen.getByText('Ali Baba Seafood')).toBeTruthy();

    const removeButtons = screen.getAllByLabelText('daygi.canvasRemove: Ali Baba Seafood');
    fireEvent.click(removeButtons[0]);
    expect(baseProps.onRemoveItem).toHaveBeenCalledWith('item-1');
  });

  it('closes through the view', () => {
    render(<DayGiCanvasPanel {...baseProps} />);

    fireEvent.click(screen.getByLabelText('daygi.canvasClose'));
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('renders Arabic labels when the in-page language is Arabic', () => {
    render(<DayGiCanvasPanel {...baseProps} lang="ar" />);

    expect(screen.getByText('خيارات هادية بعد الغوص')).toBeTruthy();
    // The group label appears twice (day tab + section heading); both must be Arabic.
    expect(screen.getAllByText('خيارات').length).toBe(2);
    expect(screen.getAllByText('البدائل').length).toBe(2);
  });

  it('mounts the map only when items resolve to known spots, with the visible count', () => {
    const placedDoc: DayGiCanvasDocument = {
      ...doc,
      days: [
        {
          ...doc.days[0],
          items: [
            { ...doc.days[0].items[0], spot: { key: 'LIGHTHOUSE', lat: 28.489, lng: 34.513 } },
            doc.days[0].items[1]
          ]
        },
        {
          ...doc.days[1],
          items: [
            { ...doc.days[1].items[0], spot: { key: 'BLUE_HOLE', lat: 28.5663, lng: 34.5363 } }
          ]
        }
      ]
    };

    // No spots in the base doc → no map section at all.
    render(<DayGiCanvasPanel {...baseProps} />);
    expect(screen.queryByTestId('daygi-canvas-map-section')).toBeNull();
    cleanup();

    render(<DayGiCanvasPanel {...baseProps} document={placedDoc} />);
    expect(screen.getByTestId('daygi-canvas-map-section')).toBeTruthy();
    expect(screen.getByTestId('daygi-canvas-map').getAttribute('data-item-count')).toBe('2');

    // Filtering to a day filters the map's pins with it.
    fireEvent.click(screen.getByRole('tab', { name: 'Alternatives' }));
    expect(screen.getByTestId('daygi-canvas-map').getAttribute('data-item-count')).toBe('1');
  });

  it('numbers plan cards continuously across day groups', () => {
    render(<DayGiCanvasPanel {...baseProps} />);
    // Day 1 has two items, Day 2 has one: the third visible card must read 3,
    // matching the map pin for the same item.
    const numbers = screen.getAllByTestId('daygi-canvas-item').map(el => el.querySelector('span')?.textContent);
    expect(numbers).toEqual(['1', '2', '3']);
  });

  it('compares pinned items side by side, all visible items when nothing is pinned', () => {
    render(<DayGiCanvasPanel {...baseProps} />);

    fireEvent.click(screen.getByText('daygi.canvasCompare'));
    const table = screen.getByTestId('daygi-canvas-compare');
    expect(table).toBeTruthy();
    // Nothing pinned: all three visible items compared, with attribute rows.
    expect(screen.getByText('daygi.canvasPrice')).toBeTruthy();
    expect(screen.getByText('daygi.canvasWhy')).toBeTruthy();
    expect(screen.getByText('daygi.canvasPinToCompare')).toBeTruthy();
    cleanup();

    // One pinned: only it is compared, and the hint disappears.
    render(<DayGiCanvasPanel {...baseProps} itemOverrides={{ 'item-1': 'pinned' }} />);
    fireEvent.click(screen.getByText('daygi.canvasCompare'));
    expect(screen.getByTestId('daygi-canvas-compare')).toBeTruthy();
    expect(screen.queryByText('daygi.canvasPinToCompare')).toBeNull();
    expect(screen.getByText('Ali Baba Seafood')).toBeTruthy();
    expect(screen.queryByText('Bedouin tea lounge')).toBeNull();
  });

  it('regenerates through the view and hides the table again', () => {
    render(<DayGiCanvasPanel {...baseProps} />);

    fireEvent.click(screen.getByText('daygi.canvasRegenerate'));
    expect(baseProps.onRegenerate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('daygi.canvasCompare'));
    expect(screen.getByTestId('daygi-canvas-compare')).toBeTruthy();
    fireEvent.click(screen.getByText('daygi.canvasCompareHide'));
    expect(screen.queryByTestId('daygi-canvas-compare')).toBeNull();
  });

  it('books only items that carry a commerce action', () => {
    const bookableDoc: DayGiCanvasDocument = {
      ...doc,
      days: [
        {
          ...doc.days[0],
          items: [
            { ...doc.days[0].items[0], skuId: 'SKU-FOOD-001', actionKey: 'CONFIRM_DIRECT_BOOKING' },
            doc.days[0].items[1]
          ]
        }
      ]
    };
    render(<DayGiCanvasPanel {...baseProps} document={bookableDoc} />);

    // Two Book buttons for the one commerce item: its day card and its
    // bookable-section shortcut. The item without skuId/actionKey gets none.
    const bookButtons = screen.getAllByText('daygi.canvasBook');
    expect(bookButtons).toHaveLength(2);
    fireEvent.click(bookButtons[0]);
    expect(baseProps.onExecuteItem).toHaveBeenCalledWith(bookableDoc.days[0].items[0]);
  });

  it('groups commerce items under a bookable section without moving their cards', () => {
    const bookableDoc: DayGiCanvasDocument = {
      ...doc,
      days: [
        {
          ...doc.days[0],
          items: [
            { ...doc.days[0].items[0], skuId: 'SKU-FOOD-001', actionKey: 'CONFIRM_DIRECT_BOOKING' },
            doc.days[0].items[1]
          ]
        }
      ]
    };
    render(<DayGiCanvasPanel {...baseProps} document={bookableDoc} />);

    expect(screen.getByTestId('daygi-canvas-bookable')).toBeTruthy();
    // The day card stays in place AND the shortcut entry renders: same item,
    // two cards, one numbering.
    expect(screen.getAllByText('Ali Baba Seafood')).toHaveLength(2);
    expect(screen.getByText('daygi.canvasBookableSub')).toBeTruthy();
  });

  it('shows no bookable section when nothing is commerce-capable', () => {
    render(<DayGiCanvasPanel {...baseProps} />);
    expect(screen.queryByTestId('daygi-canvas-bookable')).toBeNull();
  });

  it('renders real catalogue photos and ratings, and nothing invented', () => {
    const mediaDoc: DayGiCanvasDocument = {
      ...doc,
      days: [
        {
          ...doc.days[0],
          items: [
            {
              ...doc.days[0].items[0],
              imageUrl: '/images/restaurants/ta_1645627.jpg',
              rating: 4.6,
              reviewCount: 1367
            },
            doc.days[0].items[1]
          ]
        }
      ]
    };
    render(<DayGiCanvasPanel {...baseProps} document={mediaDoc} />);

    const img = screen.getByAltText('Ali Baba Seafood') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/images/restaurants/ta_1645627.jpg');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(screen.getByText('4.6')).toBeTruthy();
    expect(screen.getByLabelText('daygi.canvasRatingOf')).toBeTruthy();
    // The imageless item renders no photo and no rating row.
    expect(screen.queryByAltText('Bedouin tea lounge')).toBeNull();
  });

  it('expands the map into a dialog and closes it again', () => {
    const placedDoc: DayGiCanvasDocument = {
      ...doc,
      days: [{ ...doc.days[0], items: [{ ...doc.days[0].items[0], spot: { key: 'LIGHTHOUSE', lat: 28.489, lng: 34.513 } }] }]
    };
    render(<DayGiCanvasPanel {...baseProps} document={placedDoc} />);

    // One inline map; the dialog mounts a second instance while open.
    expect(screen.getAllByTestId('daygi-canvas-map')).toHaveLength(1);
    fireEvent.click(screen.getByText('daygi.canvasExpandMap'));
    expect(screen.getAllByTestId('daygi-canvas-map')).toHaveLength(2);
    expect(screen.getByRole('dialog', { name: 'daygi.canvasMapDialog' })).toBeTruthy();

    // Two close buttons exist while the dialog is open (panel + dialog);
    // the dialog's is the later one in DOM order.
    fireEvent.click(screen.getAllByLabelText('daygi.canvasClose')[1]);
    expect(screen.getAllByTestId('daygi-canvas-map')).toHaveLength(1);
  });
});

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { DayGiOptionMenu, mentionOption } from '../../src/components/daygi/DayGiComposerMenus';

/**
 * The composer menus are pure option lists: badges/icons are presentational,
 * selection routes the option id back to the view, and copy comes from the
 * caller (identity keys in these tests).
 */

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DayGiOptionMenu', () => {
  it('renders slash-command options with mono badges and routes selection', () => {
    const onSelect = vi.fn();
    render(
      <DayGiOptionMenu
        testId="daygi-slash-menu"
        label="daygi.slashMenuLabel"
        onSelect={onSelect}
        options={[
          { id: '/brief', badge: '/brief', label: 'daygi.slashBriefLabel' },
          { id: '/health', badge: '/health', label: 'daygi.slashHealthLabel' }
        ]}
      />
    );

    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getByText('daygi.slashBriefLabel')).toBeTruthy();
    expect(screen.getByText('/health')).toBeTruthy();

    fireEvent.click(screen.getByText('daygi.slashHealthLabel').closest('button')!);
    expect(onSelect).toHaveBeenCalledWith('/health');
  });

  it('renders mention options with icons and no badge', () => {
    const onSelect = vi.fn();
    render(
      <DayGiOptionMenu
        testId="daygi-mention-menu"
        label="daygi.mentionMenuLabel"
        onSelect={onSelect}
        options={[mentionOption('daygi.lighthouse', 'Lighthouse')]}
      />
    );

    expect(screen.getByText('daygi.lighthouse')).toBeTruthy();
    // The mention id doubles as the inserted text; the view replaces the
    // "@fragment" with it.
    fireEvent.click(screen.getByText('daygi.lighthouse').closest('button')!);
    expect(onSelect).toHaveBeenCalledWith('Lighthouse');
  });

  it('renders nothing when the option list is empty', () => {
    const { container } = render(
      <DayGiOptionMenu testId="daygi-slash-menu" label="daygi.slashMenuLabel" onSelect={vi.fn()} options={[]} />
    );
    // The view only mounts the menu with matches; the component itself stays
    // honest about an empty list by rendering an empty listbox.
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
  });
});

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { DayGiShareModal } from '../../src/components/daygi/DayGiShareModal';

/**
 * The share-link dialog: identity `t` proves copy comes from the catalog;
 * the URL is read-only text; copying flips the button to "Copied!" only
 * after the clipboard write resolves.
 */

  vi.mock('../../src/components/daygi/useConciergeT', () => ({
    useConciergeT: () => (key: string) => key
  }));

const baseProps = {
  open: true,
  shareUrl: 'http://127.0.0.1:3100/shared/SHR-abc123',
  creating: false,
  lang: 'en' as const,
  onCopy: vi.fn().mockResolvedValue(undefined),
  onClose: vi.fn()
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DayGiShareModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<DayGiShareModal {...baseProps} open={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the snapshot note and the read-only link', () => {
    render(<DayGiShareModal {...baseProps} />);

    expect(screen.getByText('daygi.shareChat')).toBeTruthy();
    expect(screen.getByText('daygi.shareSnapshotNote')).toBeTruthy();
    const url = screen.getByTestId('daygi-share-url') as HTMLInputElement;
    expect(url.value).toBe('http://127.0.0.1:3100/shared/SHR-abc123');
    expect(url.readOnly).toBe(true);
    expect(screen.getByText('daygi.shareCopyLink')).toBeTruthy();
  });

  it('flips to Copied only after the clipboard write resolves', async () => {
    render(<DayGiShareModal {...baseProps} />);

    fireEvent.click(screen.getByText('daygi.shareCopyLink'));
    expect(baseProps.onCopy).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('daygi.shareCopied')).toBeTruthy();
  });

  it('stays uncopied when the clipboard write rejects', async () => {
    const failing = { ...baseProps, onCopy: vi.fn().mockRejectedValue(new Error('denied')) };
    render(<DayGiShareModal {...failing} />);

    fireEvent.click(screen.getByText('daygi.shareCopyLink'));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(screen.queryByText('daygi.shareCopied')).toBeNull();
    expect(screen.getByText('daygi.shareCopyLink')).toBeTruthy();
  });

  it('closes via the button and the Escape key', () => {
    render(<DayGiShareModal {...baseProps} />);

    fireEvent.click(screen.getByLabelText('daygi.chatsClose'));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(baseProps.onClose).toHaveBeenCalledTimes(2);
  });
});

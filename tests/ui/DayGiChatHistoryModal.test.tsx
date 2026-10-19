import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { DayGiChatHistoryModal } from '../../src/components/daygi/DayGiChatHistoryModal';
import type { DayGiChatSummary } from '../../src/shared';

/**
 * "All chats" modal: identity `t` proves copy comes from the catalog; the
 * callbacks prove resume/delete/new/close reach the concierge view; Escape
 * must close without any other handler swallowing it.
 */

  vi.mock('../../src/components/daygi/useConciergeT', () => ({
    useConciergeT: () => (key: string) => key
  }));

const chats: DayGiChatSummary[] = [
  {
    chatId: 'CHAT-A',
    title: 'Plan 3 days in Dahab',
    createdAt: '2026-10-12T08:00:00.000Z',
    updatedAt: '2026-10-12T09:30:00.000Z',
    messageCount: 6,
    hasPlan: true
  },
  {
    chatId: 'CHAT-B',
    title: 'Seafood tonight?',
    createdAt: '2026-10-11T18:00:00.000Z',
    updatedAt: '2026-10-11T18:20:00.000Z',
    messageCount: 2,
    hasPlan: false
  }
];

const baseProps = {
  open: true,
  chats,
  loading: false,
  lang: 'en' as const,
  onResume: vi.fn(),
  onDelete: vi.fn(),
  onNewChat: vi.fn(),
  onClose: vi.fn()
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DayGiChatHistoryModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<DayGiChatHistoryModal {...baseProps} open={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('lists saved chats with catalog copy and message counts', () => {
    render(<DayGiChatHistoryModal {...baseProps} />);

    expect(screen.getByText('daygi.chatHistory')).toBeTruthy();
    expect(screen.getByText('Plan 3 days in Dahab')).toBeTruthy();
    expect(screen.getByText('Seafood tonight?')).toBeTruthy();
    expect(screen.getAllByText('daygi.messagesCount').length).toBe(2);
    expect(screen.getByText('daygi.newChat')).toBeTruthy();
  });

  it('shows the empty state and loading state from the catalog', () => {
    cleanup();
    render(<DayGiChatHistoryModal {...baseProps} chats={[]} />);
    expect(screen.getByText('daygi.noChatsYet')).toBeTruthy();

    cleanup();
    render(<DayGiChatHistoryModal {...baseProps} chats={[]} loading={true} />);
    expect(screen.getByText('daygi.loadingChats')).toBeTruthy();
  });

  it('resumes through the view when a chat row is clicked', () => {
    render(<DayGiChatHistoryModal {...baseProps} />);

    fireEvent.click(screen.getByText('Plan 3 days in Dahab'));
    expect(baseProps.onResume).toHaveBeenCalledWith('CHAT-A');
  });

  it('deletes through the view with an accessible label', () => {
    render(<DayGiChatHistoryModal {...baseProps} />);

    fireEvent.click(screen.getByLabelText('daygi.deleteChat: Seafood tonight?'));
    expect(baseProps.onDelete).toHaveBeenCalledWith('CHAT-B');
  });

  it('starts a new chat through the view', () => {
    render(<DayGiChatHistoryModal {...baseProps} />);

    fireEvent.click(screen.getByText('daygi.newChat'));
    expect(baseProps.onNewChat).toHaveBeenCalled();
  });

  it('closes via the button, the scrim, and the Escape key', () => {
    render(<DayGiChatHistoryModal {...baseProps} />);

    fireEvent.click(screen.getByLabelText('daygi.chatsClose'));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('daygi-chat-history'));
    expect(baseProps.onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(baseProps.onClose).toHaveBeenCalledTimes(3);
  });

  it('renders Arabic chat titles as stored, in RTL direction', () => {
    const arabicChats: DayGiChatSummary[] = [
      { ...chats[0], title: 'خطة ٣ أيام في دهب' }
    ];
    render(<DayGiChatHistoryModal {...baseProps} chats={arabicChats} lang="ar" />);

    expect(screen.getByText('خطة ٣ أيام في دهب')).toBeTruthy();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('dir')).toBe('rtl');
  });

  it('filters to plan-carrying chats without touching the fetched list', () => {
    const mixed: DayGiChatSummary[] = [
      { ...chats[0], hasPlan: true },
      { ...chats[1], hasPlan: false }
    ];
    render(<DayGiChatHistoryModal {...baseProps} chats={mixed} />);

    expect(screen.getByText('Plan 3 days in Dahab')).toBeTruthy();
    expect(screen.getByText('Seafood tonight?')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'daygi.chatsWithPlan' }));
    expect(screen.getByText('Plan 3 days in Dahab')).toBeTruthy();
    expect(screen.queryByText('Seafood tonight?')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'daygi.chatsAll' }));
    expect(screen.getByText('Seafood tonight?')).toBeTruthy();
  });
});

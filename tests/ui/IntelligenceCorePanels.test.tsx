import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { ActionPlan } from '../../src/components/intelligence-core/ActionPlan';
import { AuditTrail } from '../../src/components/intelligence-core/AuditTrail';
import { CommandUI } from '../../src/components/intelligence-core/CommandUI';

vi.mock('../../src/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    isRTL: false,
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('../../src/services/api', () => ({
  api: {
    intelligenceCoreAction: vi.fn(async () => ({
      executed: true,
      result: {
        rows: [
          { at: new Date().toISOString(), action: 'INTELLIGENCE_CORE_QUERY', actor: 'U', entity: 'query', detail: '{}' },
        ],
        total: 1,
      },
    })),
  },
}));

const t = (key: string, fallback?: string) => fallback ?? key;

describe('ActionPlan', () => {
  afterEach(() => cleanup());

  it('renders nothing without a confirmation or failures', () => {
    const { container } = render(
      <ActionPlan confirm={null} result={null} busy={false} onConfirm={() => undefined} onCancel={() => undefined} t={t} />,
    );
    expect(container.textContent).toBe('');
  });

  it('shows per-item bulk failures after execution', () => {
    render(
      <ActionPlan
        confirm={null}
        result={{ ok: 1, failed: 1, failures: [{ id: 'BK-1', error: 'gone' }] }}
        busy={false}
        onConfirm={() => undefined}
        onCancel={() => undefined}
        t={t}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('BK-1');
    expect(screen.getByRole('alert').textContent).toContain('gone');
  });

  it('shows impact and expiry on a pending confirmation', () => {
    render(
      <ActionPlan
        confirm={{ token: 'ICF-x', tool: 'cancelBooking', impact: 'Cancel it', affectedCount: 1, risk: 'HIGH', expiresAt: new Date().toISOString() }}
        result={null}
        busy={false}
        onConfirm={() => undefined}
        onCancel={() => undefined}
        t={t}
      />,
    );
    expect(screen.getByRole('button', { name: 'Confirm and execute' })).toBeTruthy();
    expect(screen.getByText(/Cancel it/)).toBeTruthy();
  });
});

describe('AuditTrail', () => {
  afterEach(() => cleanup());

  it('loads and renders Core audit entries on demand', async () => {
    render(<AuditTrail t={t} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show audit trail' }));
    expect(await screen.findByText(/INTELLIGENCE_CORE_QUERY/)).toBeTruthy();
  });
});

describe('CommandUI', () => {
  afterEach(() => cleanup());

  it('submits typed text and degrades without voice in jsdom', () => {
    const onAsk = vi.fn();
    render(<CommandUI busy={false} onAsk={onAsk} t={t} language="en" />);
    const input = screen.getByTestId('intel-command');
    fireEvent.change(input, { target: { value: 'Show dashboard' } });
    fireEvent.submit(input.closest('form')!);
    expect(onAsk).toHaveBeenCalledWith('Show dashboard');
    // jsdom has no Web Speech: no mic / speaker buttons, text keeps working.
    expect(screen.queryByRole('button', { name: 'Voice input' })).toBeNull();
  });
});

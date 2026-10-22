import * as React from 'react';
import { parse } from 'date-fns';

import { MeetingScheduler } from '@/components/ui/meeting-scheduler';
import { useLanguage } from '@/i18n/LanguageContext';

const AR_WEEKDAYS = ['إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت', 'أحد'];

/**
 * Design-system demo for the themed scheduler primitives. Reachable at
 * /design; uses the real language context so the AR surface is exercised too.
 */
export const SchedulerDemoPage: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [scheduled, setScheduled] = React.useState<string | null>(null);

  const initialStartDate = parse('2026-10-14 09:00', 'yyyy-MM-dd HH:mm', new Date());
  const initialEndDate = parse('2026-10-20 10:00', 'yyyy-MM-dd HH:mm', new Date());

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-4xl">
        {scheduled ? (
          <div className="rounded-2xl border border-border-subtle bg-surface-card p-8 text-center">
            <p className="font-display text-2xl text-text-primary">
              {isAr ? 'تم جدولة الاجتماع' : 'Meeting scheduled'}
            </p>
            <p className="mt-2 text-sm text-text-secondary">{scheduled}</p>
          </div>
        ) : (
          <MeetingScheduler
            title={isAr ? 'جدولة اجتماع' : 'Schedule a meeting'}
            description={isAr ? 'أنشئ اجتماعك القادم بسهولة.' : 'Create your next meeting easily.'}
            scheduleButtonText={isAr ? 'جدولة' : 'Schedule'}
            cancelButtonText={isAr ? 'إلغاء' : 'Cancel'}
            weekdayLabels={isAr ? AR_WEEKDAYS : undefined}
            initialStartDate={initialStartDate}
            initialEndDate={initialEndDate}
            onSchedule={({ startDate, endDate, aiNotes }) =>
              setScheduled(
                `${startDate?.toDateString() ?? '—'} → ${endDate?.toDateString() ?? '—'} · AI notes: ${aiNotes}`,
              )
            }
            onCancel={() => setScheduled(isAr ? 'تم الإلغاء.' : 'Scheduling cancelled.')}
          />
        )}
      </div>
    </div>
  );
};

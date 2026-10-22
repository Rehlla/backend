import React from 'react';
import { Car, Clock } from 'lucide-react';
import { Badge } from '../ui/badge';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TransferTelemetry } from '../../services/api';

/**
 * Who is driving, or the honest fact that nobody is yet.
 *
 * The server answers a transfer that no supplier has dispatched with
 * `assigned: false`, status NOT_ASSIGNED and null driver/vehicle fields. It
 * used to return a canned "Mahmoud Salem" for any booking, and this UI used to
 * print whatever came back — so the traveller looked for a driver who did
 * not exist. A missing driver is now said out loud, with what happens next.
 */
export function isDriverAssigned(
  telemetry: Pick<TransferTelemetry, 'assigned' | 'status' | 'driverName' | 'driverPhone'> | null | undefined
): boolean {
  if (!telemetry) return false;
  if (telemetry.assigned === false || telemetry.status === 'NOT_ASSIGNED') return false;
  return Boolean(telemetry.driverName || telemetry.driverPhone);
}

export const DriverAssignmentStatus: React.FC<{
  telemetry: TransferTelemetry | null | undefined;
  className?: string;
}> = ({ telemetry, className }) => {
  const { t, language } = useLanguage();

  if (!telemetry || !isDriverAssigned(telemetry)) {
    return (
      <div role="status" className={`rounded-dg-md bg-dg-sunken px-4 py-3 space-y-1.5 ${className ?? ''}`}>
        <Badge tone="warning" icon={<Clock className="h-3.5 w-3.5" aria-hidden="true" />}>
          {t('transfers.driver.pendingBadge')}
        </Badge>
        <p className="text-sm text-dg-ink">{t('transfers.driver.notAssigned')}</p>
      </div>
    );
  }

  const name = language === 'ar' && telemetry.driverNameAr ? telemetry.driverNameAr : telemetry.driverName;
  const vehicle = [telemetry.vehicleModel, telemetry.vehiclePlate].filter(Boolean).join(' · ');
  return (
    <div role="status" className={`rounded-dg-md bg-dg-sunken px-4 py-3 space-y-1 ${className ?? ''}`}>
      <Badge tone="positive" icon={<Car className="h-3.5 w-3.5" aria-hidden="true" />}>
        {t('transfers.driver.assignedBadge')}
      </Badge>
      {name && <p className="text-sm font-semibold text-dg-ink">{name}</p>}
      {vehicle && <p className="text-[0.8125rem] text-dg-ink-2" dir="auto">{vehicle}</p>}
      {telemetry.driverPhone && (
        <a className="text-[0.8125rem] font-semibold text-dg-action" dir="ltr" href={`tel:${telemetry.driverPhone.replace(/\s+/g, '')}`}>
          {telemetry.driverPhone}
        </a>
      )}
    </div>
  );
};

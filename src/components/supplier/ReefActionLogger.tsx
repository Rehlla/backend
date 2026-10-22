import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { ReefActionForm, toEligibleBookings, type EligibleBooking } from '../common/ReefActionForm';

/**
 * ReefActionLogger — supplier-side entry point for recording eco-actions
 * against the supplier's own completed bookings. The form itself is the shared
 * ReefActionForm; this wrapper owns fetching the supplier's bookings.
 */
export const ReefActionLogger: React.FC<{ supplierId: string | null }> = ({ supplierId }) => {
  const [bookings, setBookings] = useState<EligibleBooking[] | null>(null);

  // Fetch on mount (the form's own expand state lives inside ReefActionForm).
  useEffect(() => {
    if (!supplierId || bookings != null) return;
    let cancelled = false;
    api.getSupplierBookings(supplierId)
      .then((data: { bookings?: Array<Record<string, any>> }) => {
        if (cancelled) return;
        setBookings(toEligibleBookings(data.bookings ?? []));
      })
      .catch(() => { if (!cancelled) setBookings([]); });
    return () => { cancelled = true; };
  }, [supplierId, bookings]);

  if (!supplierId) return null;

  return <ReefActionForm bookings={bookings} />;
};
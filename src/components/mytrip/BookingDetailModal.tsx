import React from 'react';
import { 
  X, 
  Building, 
  Car, 
  Waves, 
  Compass, 
  Bike, 
  Check, 
  Calendar, 
  MapPin, 
  Users, 
  Copy, 
  FileText,
  ShieldCheck,
  Phone,
  Mail
} from 'lucide-react';
import { ConfirmedBookingItem } from './myTripData';
import { useTheme } from '../../context/ThemeContext';

interface BookingDetailModalProps {
  booking: ConfirmedBookingItem | null;
  isOpen: boolean;
  onClose: () => void;
  /** Rental bookings can be cancelled by the traveler; wired by MyTripView. */
  onCancelRental?: (booking: ConfirmedBookingItem) => void;
  cancelling?: boolean;
}

/** Terminal states a traveler can no longer cancel from. */
const RENTAL_CANCELABLE_STATUSES: ReadonlyArray<ConfirmedBookingItem['status']> = [
  'Pending',
  'Confirmed ✓'
];

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  booking,
  isOpen,
  onClose,
  onCancelRental,
  cancelling = false,
}) => {
  const [copied, setCopied] = React.useState(false);
  const { isDark } = useTheme();

  if (!isOpen || !booking) return null;

  const handleCopyCode = () => {
    navigator.clipboard?.writeText?.(booking.confirmationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getServiceIcon = () => {
    switch (booking.iconType) {
      case 'building':
        return <Building className="w-5 h-5 text-[var(--brand-coral)]" />;
      case 'car':
        return <Car className="w-5 h-5 text-[var(--accent-primary)]" />;
      case 'waves':
        return <Waves className="w-5 h-5 text-[var(--accent-primary)]" />;
      case 'compass':
        return <Compass className="w-5 h-5 text-[var(--brand-coral)]" />;
      case 'bike':
        return <Bike className="w-5 h-5 text-[var(--accent-primary)]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`rounded-3xl max-w-lg w-full p-6 sm:p-7 border shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto ${
          'bg-[var(--surface-card)] text-[var(--text-primary)] border-[var(--border-subtle)]'
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className={`flex items-start justify-between border-b pb-4 border-[var(--border-subtle)]`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${
              'bg-[var(--surface-container)] border-[var(--border-subtle)]'
            }`}>
              {getServiceIcon()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-black ${'text-[var(--accent-primary)]'}`}>
                  {booking.title} Booking
                </span>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  booking.status === 'Confirmed ✓'
                    ? (isDark ? 'text-[var(--accent-primary)] bg-[var(--surface-container)] border-[var(--border-subtle)]' : 'text-[var(--surface-card)] bg-emerald-50 border-emerald-200')
                    : booking.status === 'Changed'
                      ? (isDark ? 'text-red-300 bg-red-500/10 border-red-500/30' : 'text-red-600 bg-red-50 border-red-200')
                      : (isDark ? 'text-amber-300 bg-amber-500/10 border-amber-500/30' : 'text-amber-600 bg-amber-50 border-amber-200')
                }`}>
                  {booking.status}
                </span>
              </div>
              <h3 className={`text-xl font-bold mt-0.5 text-[var(--text-primary)]`}>
                {booking.subtitle}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isDark ? 'bg-[var(--surface-container)] hover:bg-[var(--btn-util-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]' : 'bg-[var(--surface-container)] hover:bg-[var(--surface-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Confirmation Code Card */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
          'bg-[var(--surface-container)] border-[var(--border-subtle)]'
        }`}>
          <div>
            <span className={`text-[11px] font-bold block ${'text-[var(--text-secondary)]'}`}>
              Voucher / Reference Code
            </span>
            <span className={`font-mono text-sm font-bold text-[var(--accent-secondary)]`}>
              {booking.confirmationCode}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm ${
              isDark 
                ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--btn-util-hover)]' 
                : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--surface-container)]'
            }`}
          >
            <Copy className={`w-3.5 h-3.5 text-[var(--accent-secondary)]`} />
            <span>{copied ? 'Copied! ✓' : 'Copy'}</span>
          </button>
        </div>

        {/* Key Info Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className={`p-3.5 rounded-2xl border space-y-1 ${
            'bg-[var(--surface-container)] border-[var(--border-subtle)]'
          }`}>
            <span className={`font-medium flex items-center gap-1 ${'text-[var(--text-secondary)]'}`}>
              <Calendar className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Timing / Schedule</span>
            </span>
            <p className={`font-bold text-[var(--text-primary)]`}>{booking.datesOrTime}</p>
          </div>

          <div className={`p-3.5 rounded-2xl border space-y-1 ${
            'bg-[var(--surface-container)] border-[var(--border-subtle)]'
          }`}>
            <span className={`font-medium flex items-center gap-1 ${'text-[var(--text-secondary)]'}`}>
              <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Location / Meeting Point</span>
            </span>
            <p className={`font-bold truncate text-[var(--text-primary)]`}>{booking.location}</p>
          </div>

          <div className={`p-3.5 rounded-2xl border space-y-1 ${
            'bg-[var(--surface-container)] border-[var(--border-subtle)]'
          }`}>
            <span className={`font-medium flex items-center gap-1 ${'text-[var(--text-secondary)]'}`}>
              <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Lead Guest</span>
            </span>
            <p className={`font-bold text-[var(--text-primary)]`}>Ahmed (2 Travelers)</p>
          </div>

          <div className={`p-3.5 rounded-2xl border space-y-1 ${
            'bg-[var(--surface-container)] border-[var(--border-subtle)]'
          }`}>
            <span className={`font-medium flex items-center gap-1 ${'text-[var(--text-secondary)]'}`}>
              <FileText className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Provider</span>
            </span>
            <p className={`font-bold truncate text-[var(--text-primary)]`}>{booking.provider}</p>
          </div>
        </div>

        {/* Details description */}
        <div className={`p-4 rounded-2xl border text-xs space-y-1 ${
          'bg-[var(--surface-container)] border-[var(--border-subtle)]'
        }`}>
          <span className={`font-bold block text-[var(--text-primary)]`}>What's Included:</span>
          <p className={`leading-relaxed text-[var(--text-secondary)]`}>{booking.details}</p>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-2.5">
          {booking.serviceType === 'rental' &&
            onCancelRental &&
            RENTAL_CANCELABLE_STATUSES.includes(booking.status) && (
              <button
                type="button"
                disabled={cancelling}
                onClick={() => onCancelRental(booking)}
                className="w-full py-3 rounded-full border border-red-500/40 text-red-500 hover:bg-red-500/10 font-extrabold text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelling ? 'Cancelling…' : 'Cancel this rental booking'}
              </button>
            )}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-full bg-[var(--brand-coral)] hover:bg-[var(--brand-coral)] text-[var(--text-secondary)] font-extrabold text-xs transition-colors cursor-pointer shadow-md"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};

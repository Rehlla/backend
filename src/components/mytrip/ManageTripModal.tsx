import React from 'react';
import { 
  X, 
  Edit3, 
  PlusCircle, 
  RefreshCw, 
  FileText, 
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ManageTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (option: string) => void;
  /**
   * Deleting is only offered while nothing on the trip is booked — a trip in
   * DRAFT/PLANNED can be discarded, one with real bookings goes through
   * Dahab Booking Care instead.
   */
  canDelete: boolean;
  isDeleting: boolean;
  onDelete: () => void;
}

export const ManageTripModal: React.FC<ManageTripModalProps> = ({
  isOpen,
  onClose,
  onSelectOption,
  canDelete,
  isDeleting,
  onDelete,
}) => {
  const { isDark } = useTheme();

  if (!isOpen) return null;

  const manageOptions = [
    {
      id: 'edit-itinerary',
      title: 'Edit itinerary',
      desc: 'Rearrange free time, adjust morning pacing, or swap suggested dining spots.',
      icon: <Edit3 className="w-4 h-4 text-[var(--brand-coral)]" />,
    },
    {
      id: 'add-activity',
      title: 'Add activity',
      desc: 'Browse optional yoga sessions, windsurfing lessons, or Ras Abu Galum boat trips.',
      icon: <PlusCircle className="w-4 h-4 text-[var(--accent-primary)]" />,
    },
    {
      id: 'change-booking',
      title: 'Change booking',
      desc: 'Request date shifts, room category upgrades, or change transfer pickup times.',
      icon: <RefreshCw className="w-4 h-4 text-[var(--brand-coral)]" />,
    },
    {
      id: 'view-booking-details',
      title: 'View booking details',
      desc: 'Access unified voucher codes, operator contact cards, and payment receipts.',
      icon: <FileText className="w-4 h-4 text-[var(--accent-primary)]" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`rounded-3xl max-w-lg w-full p-6 sm:p-7 border shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 ${
          'bg-[var(--surface-card)] text-[var(--text-primary)] border-[var(--border-subtle)]'
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className={`flex items-center justify-between border-b pb-3.5 ${
          'border-[var(--border-subtle)]'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
              'bg-[var(--surface-container)] text-[var(--accent-primary)] border-[var(--border-subtle)]'
            }`}>
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <span className={`text-[11px] font-bold block ${
                'text-[var(--accent-primary)]'
              }`}>
                Trip Options
              </span>
              <h3 className={`text-lg font-bold ${
                'text-[var(--text-primary)]'
              }`}>
                Manage Trip
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer border ${
              'bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options List */}
        <div className="space-y-2.5">
          {manageOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              id={`manage-option-${opt.id}`}
              onClick={() => {
                onSelectOption(opt.id);
                onClose();
              }}
              className={`w-full p-3.5 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-between gap-3 text-start group cursor-pointer ${
                isDark 
                  ? 'bg-[var(--surface-container)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-container)]/90' 
                  : 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-container)]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-105 transition-transform ${
                  'bg-[var(--surface-card)] border-[var(--border-subtle)]'
                }`}>
                  {opt.icon}
                </div>
                <div className="space-y-0.5">
                  <h4 className={`text-xs font-bold transition-colors ${
                    isDark ? 'text-[var(--text-primary)] group-hover:text-[var(--accent-secondary)]' : 'text-[var(--text-primary)] group-hover:text-[var(--brand-coral)]'
                  }`}>
                    {opt.title}
                  </h4>
                  <p className={`text-[12px] leading-relaxed ${
                    'text-[var(--text-secondary)]'
                  }`}>
                    {opt.desc}
                  </p>
                </div>
              </div>

              <ChevronRight className={`w-4 h-4 group-hover:translate-x-0.5 rtl:rotate-180 transition-[background-color,border-color,color,box-shadow,transform,opacity] flex-shrink-0 ${
                'text-[var(--text-secondary)]/40 group-hover:text-[var(--text-primary)]'
              }`} />
            </button>
          ))}

          {canDelete && (
            <button
              type="button"
              id="manage-option-delete-trip"
              disabled={isDeleting}
              onClick={() => {
                if (window.confirm('Delete this trip? Its unbooked items will be removed. This cannot be undone.')) {
                  onDelete();
                }
              }}
              className={`w-full p-3.5 rounded-2xl border transition-[background-color,border-color,color,box-shadow,opacity] flex items-center justify-between gap-3 text-start cursor-pointer disabled:opacity-60 ${
                'border-transparent bg-[var(--brand-coral)]/10 hover:bg-[var(--brand-coral)]/20 text-[var(--brand-coral)]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  'bg-[var(--surface-card)] border-[var(--border-subtle)]'
                }`}>
                  <Trash2 className="w-4 h-4 text-[var(--brand-coral)]" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold">Delete trip</h4>
                  <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
                    Remove this planned trip and its unbooked items. Booked items must be cancelled first.
                  </p>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 group-hover:translate-x-0.5 rtl:rotate-180 transition-[background-color,border-color,color,box-shadow,transform,opacity] flex-shrink-0 ${
                'text-[var(--text-secondary)]/40'
              }`} />
            </button>
          )}
        </div>

        {/* Footer reassurance */}
        <div className={`pt-2 text-center text-xs flex items-center justify-center gap-1.5 border-t ${
          'text-[var(--text-secondary)] border-[var(--border-subtle)]'
        }`}>
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>Changes are protected by Dahab Booking Care</span>
        </div>
      </div>
    </div>
  );
};

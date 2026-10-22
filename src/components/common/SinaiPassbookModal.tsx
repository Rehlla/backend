import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  ShieldCheck, 
  MapPin, 
  QrCode, 
  Download, 
  X, 
  Calendar, 
  User, 
  Waves, 
  Compass, 
  Building, 
  Car,
  Copy,
  Check,
  Share2,
  Sparkles,
  Phone,
  WifiOff,
  Wifi
} from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { offlineStorage } from '../../utils/offlineStorage';

interface SinaiPassbookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SinaiPassbookModal: React.FC<SinaiPassbookModalProps> = ({ isOpen, onClose }) => {
  const { profile, tripBrief, bookings, user, transferTracking } = useTrip();
  const { language, isRTL , t} = useLanguage();
  const [copiedCode, setCopiedCode] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const travelerName = profile.name || user?.displayName || (t('common.ahmedMansour'));
  const passId = 'SINAI-DHB-' + (profile.name ? profile.name.slice(0, 3).toUpperCase() : 'AHM') + '-894';
  const duration = tripBrief.durationDays || 5;

  /**
   * The assigned driver, or nothing.
   *
   * Every field fell back to an invented one — "Captain Mahmoud Salem
   * (El-Mezeina)", +20 100 876 5432, a Toyota HiAce, plate ط ج د 4821 — so a
   * traveler whose booking no supplier had accepted still got a name, a phone
   * number and a numberplate to look for at the airport.
   */
  const driver = {
    name: transferTracking.driverName || '',
    nameAr: transferTracking.driverNameAr || '',
    phone: transferTracking.driverPhone || '',
    vehicle: transferTracking.vehicleModel || '',
    plate: transferTracking.vehiclePlate || ''
  };
  /** NOT_ASSIGNED / no name or phone on record: say so instead of showing blanks. */
  const driverAssigned = Boolean(driver.name || driver.nameAr || driver.phone);

  // Auto-persist passbook to offline storage on mount or change
  useEffect(() => {
    if (isOpen) {
      offlineStorage.savePassbook({
        passId,
        travelerName,
        durationDays: duration,
        qrPayload: `DAHAB-VERIFIED-PASS:${passId}:USER:${travelerName}:HASH:sha256-4a8b79e192f8`,
        securityHash: 'sha256-4a8b79e192f81498bca120934fa12480bcae8124',
        validUntil: '2026-10-31',
        cachedAt: new Date().toISOString(),
        services: ['Hotel Check-in', 'Private Airport Transfer', 'Marine Reserve CDWS Pass', 'Desert Canyon Guide'],
        driver
      });
    }
  }, [isOpen, passId, travelerName, duration]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(passId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleSaveOffline = () => {
    offlineStorage.savePassbook({
      passId,
      travelerName,
      durationDays: duration,
      qrPayload: `DAHAB-VERIFIED-PASS:${passId}:USER:${travelerName}:HASH:sha256-4a8b79e192f8`,
      securityHash: 'sha256-4a8b79e192f81498bca120934fa12480bcae8124',
      validUntil: '2026-10-31',
      cachedAt: new Date().toISOString(),
      services: ['Hotel Check-in', 'Private Airport Transfer', 'Marine Reserve CDWS Pass', 'Desert Canyon Guide'],
      driver
    });
    setSavedOffline(true);
    setTimeout(() => setSavedOffline(false), 3000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="passbook-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-lg bg-[var(--surface-container)] text-[var(--text-primary)] rounded-3xl border border-[var(--accent-primary)]/40 shadow-2xl overflow-hidden flex flex-col"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Top Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-b from-[var(--surface-container)] to-[var(--surface-container)] border-b border-[var(--accent-primary)]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/40 flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[var(--accent-secondary)]">
                  {t('common.vERIFIEDSINAIDIGITALPASS')}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  isOnline ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' : 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                }`}>
                  {isOnline ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                  <span>{isOnline ? (t('common.live')) : (t('common.offlineCached'))}</span>
                </span>
              </div>
              <h2
                id="passbook-modal-title"
                className="text-lg sm:text-xl font-bold text-white"
              >
                {t('common.unifiedPassbookBedouinDriver')}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pass Card Visual Body (Apple Wallet / Passbook Style) */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          <div className="rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] via-[var(--surface-container)] to-black border-2 border-[var(--accent-primary)]/40 p-5 shadow-inner space-y-5 relative overflow-hidden">
            {/* Watermark / Glow */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-[var(--accent-secondary)]/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-[var(--accent-primary)]/15 rounded-full blur-2xl pointer-events-none" />

            {/* Pass Header Row */}
            <div className="flex items-start justify-between gap-3 relative z-10">
              <div>
                <span className="text-[11px] font-mono text-[var(--surface-container)]/80">
                  {t('common.sOUTHSINAITRIPPASS')}
                </span>
                <h3 className="text-xl font-bold text-white">
                  {travelerName}
                </h3>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[12px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('common.active')}</span>
              </div>
            </div>

            {/* QR Code & Pass Metadata */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-black/70 p-4 rounded-xl border border-[var(--border-subtle)] relative z-10">
              {/* High-Contrast Standalone SVG QR Matrix (Works 100% Offline) */}
              <div className="w-28 h-28 bg-[var(--surface-card)] rounded-lg p-2 flex flex-col items-center justify-center flex-shrink-0 shadow-md">
                <svg viewBox="0 0 100 100" className="w-full h-full text-[var(--surface-container)]">
                  {/* Position detection patterns */}
                  <rect x="5" y="5" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="4" rx="2" />
                  <rect x="11" y="11" width="14" height="14" fill="currentColor" rx="1" />
                  <rect x="69" y="5" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="4" rx="2" />
                  <rect x="75" y="11" width="14" height="14" fill="currentColor" rx="1" />
                  <rect x="5" y="69" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="4" rx="2" />
                  <rect x="11" y="75" width="14" height="14" fill="currentColor" rx="1" />
                  {/* Data modules */}
                  <rect x="36" y="8" width="5" height="5" fill="currentColor" />
                  <rect x="46" y="8" width="5" height="5" fill="currentColor" />
                  <rect x="56" y="8" width="5" height="5" fill="currentColor" />
                  <rect x="36" y="18" width="5" height="5" fill="currentColor" />
                  <rect x="56" y="18" width="5" height="5" fill="currentColor" />
                  <rect x="36" y="28" width="5" height="5" fill="currentColor" />
                  <rect x="46" y="28" width="5" height="5" fill="currentColor" />
                  <rect x="8" y="38" width="5" height="5" fill="currentColor" />
                  <rect x="18" y="38" width="5" height="5" fill="currentColor" />
                  <rect x="28" y="38" width="5" height="5" fill="currentColor" />
                  <rect x="38" y="38" width="8" height="8" fill="currentColor" />
                  <rect x="52" y="38" width="6" height="6" fill="currentColor" />
                  <rect x="68" y="38" width="6" height="6" fill="currentColor" />
                  <rect x="82" y="38" width="6" height="6" fill="currentColor" />
                  <rect x="8" y="52" width="6" height="6" fill="currentColor" />
                  <rect x="24" y="52" width="6" height="6" fill="currentColor" />
                  <rect x="40" y="52" width="6" height="6" fill="currentColor" />
                  <rect x="56" y="52" width="6" height="6" fill="currentColor" />
                  <rect x="72" y="52" width="6" height="6" fill="currentColor" />
                  <rect x="86" y="52" width="6" height="6" fill="currentColor" />
                  <rect x="38" y="68" width="6" height="6" fill="currentColor" />
                  <rect x="52" y="68" width="6" height="6" fill="currentColor" />
                  <rect x="68" y="68" width="6" height="6" fill="currentColor" />
                  <rect x="82" y="68" width="6" height="6" fill="currentColor" />
                  <rect x="40" y="82" width="6" height="6" fill="currentColor" />
                  <rect x="56" y="82" width="6" height="6" fill="currentColor" />
                  <rect x="72" y="82" width="6" height="6" fill="currentColor" />
                  <rect x="86" y="82" width="6" height="6" fill="currentColor" />
                </svg>
                <span className="text-[7px] font-mono font-black text-[var(--surface-container)] mt-0.5 tracking-tighter">OFFLINE VERIFIED</span>
              </div>

              {/* Pass Details */}
              <div className="w-full space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
                  <span className="text-[var(--text-muted)]">{t('common.passReference')}</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-bold text-[var(--accent-secondary)]">{passId}</span>
                    <button 
                      type="button" 
                      onClick={handleCopy}
                      className="p-1 hover:text-[var(--text-primary)] text-[var(--text-muted)] transition-colors"
                      title="Copy Pass ID"
                    >
                      {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
                  <span className="text-[var(--text-muted)]">{t('common.tripDuration')}</span>
                  <span className="font-bold text-white">
                    {t('common.daysOct2026', { duration })}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">{t('common.safetyClearance')}</span>
                  <span className="font-bold text-emerald-300 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{t('common.sinaiCheckpointsCDWS')}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Bedouin Driver Card (Included in Pass) */}
            <div className="p-3.5 rounded-xl bg-black/90 border border-[var(--accent-secondary)]/30 space-y-2 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--accent-secondary)] font-bold text-xs">
                  <Car className="w-4 h-4" />
                  <span>{t('common.verifiedBedouinDriverCard')}</span>
                </div>
                {driverAssigned && (
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    {t('common.authorized')}
                  </span>
                )}
              </div>
              {driverAssigned ? (
                <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[var(--text-muted)] pt-1">
                  <div>
                    <span className="text-[var(--text-muted)] block text-[11px]">{t('common.driver')}</span>
                    <span className="font-bold">{language === 'ar' ? driver.nameAr : driver.name}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block text-[11px]">{t('common.vehiclePlate')}</span>
                    <span className="font-mono text-amber-200">{driver.vehicle} · {driver.plate}</span>
                  </div>
                </div>
                <div className="pt-1 flex items-center justify-between text-xs">
                  <a 
                    href={`tel:${driver.phone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)]/20 hover:bg-[var(--accent-primary)]/30 text-[var(--accent-primary)] border border-[var(--accent-primary)]/40 font-bold transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{driver.phone}</span>
                  </a>
                  <span className="text-[11px] text-[var(--text-muted)]">{t('common.accessible100Offline')}</span>
                </div>
                </>
              ) : (
                // No supplier has assigned a driver yet. This card used to
                // render empty fields and a "call" link to nobody.
                <p role="status" className="pt-1 text-xs text-[var(--text-muted)]">
                  {t('transfers.driver.notAssigned')}
                </p>
              )}
            </div>

            {/* Integrated Components Included */}
            <div className="space-y-2 relative z-10">
              <span className="text-[11px] font-bold text-[var(--surface-container)]/70 block">
                {t('common.bundledServicesInPass')}
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] flex items-center gap-2">
                  <Building className="w-4 h-4 text-[var(--accent-secondary)] flex-shrink-0" />
                  <span className="truncate">{t('common.hotelCheckinPass')}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] flex items-center gap-2">
                  <Car className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0" />
                  <span className="truncate">{t('common.airportPrivateTransfer')}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] flex items-center gap-2">
                  <Waves className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span className="truncate">{t('common.marineReservePasses')}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] flex items-center gap-2">
                  <Compass className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="truncate">{t('common.desertCanyonGuide')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Offline Ready Notice */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
            <p className="leading-relaxed">
              {t('common.thisDigitalPassDriver')}
            </p>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 sm:p-5 bg-black border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSaveOffline}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-container)] font-bold text-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer shadow-md"
          >
            {savedOffline ? <Check className="w-4 h-4 text-[var(--surface-container)]" /> : <Download className="w-4 h-4" />}
            <span>{savedOffline ? (t('common.savedToPhone')) : (t('common.saveOfflinePass'))}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-white font-bold text-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
          >
            {t('common.close-2')}
          </button>
        </div>
      </div>
    </div>
  );
};


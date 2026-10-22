import React, { useState } from 'react';
import {
  Download,
  Printer,
  ShieldCheck,
  MapPin,
  Clock,
  Phone,
  Compass,
  AlertTriangle,
  FileText,
  CheckCircle2,
  X,
  Share2,
  WifiOff,
  BatteryCharging,
  Sun,
  Flame,
  Wind,
  Info
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTrip } from '../../context/TripContext';
import { buildDahabOfflineTripPack } from '../../services/dahabLocalEngine';

interface OfflineTripPackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfflineTripPackModal: React.FC<OfflineTripPackModalProps> = ({ isOpen, onClose }) => {
  const { language, isRTL , t} = useLanguage();
  const { tripBrief, tripDays, bookings, showToast } = useTrip();
  const [activeTab, setActiveTab] = useState<'itinerary' | 'vouchers' | 'emergency' | 'checklist'>('itinerary');

  if (!isOpen) return null;

  const pack = buildDahabOfflineTripPack(tripBrief, tripDays, bookings);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(pack, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Dahab_Offline_Trip_Pack_${pack.traveler.name.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Offline Trip Pack downloaded for remote access ✓');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn text-[var(--text-primary)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-trip-pack-modal-dialog-1-title"
    >
      <div className="bg-[var(--surface-card)] text-[var(--text-primary)] w-full max-w-4xl rounded-3xl shadow-2xl border border-[var(--border-subtle)] overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-[var(--surface-container)] text-[var(--text-primary)] p-6 flex items-start justify-between border-b border-[var(--border-subtle)]">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--border-subtle)]">
                <WifiOff className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                {t('officialOfflineTripPack')}
              </span>
              <span className="text-xs text-[var(--text-secondary)]/60">
                v{pack.packageVersion}
              </span>
            </div>
            <h2 id="offline-trip-pack-modal-dialog-1-title" className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {t('dahabSinaiReservesOffline')}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]/80 mt-1">
              {t('authoritativeOfflinePackageWith')}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[var(--text-secondary)]/70 hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--surface-card)]/10 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Dynamic Freshness Banner */}
        <div className="bg-[var(--surface-container)] border-b border-[var(--border-subtle)] p-3 px-6 flex items-center gap-3 text-xs text-[var(--text-secondary)]">
          <Info className="w-4 h-4 text-[var(--accent-secondary)] shrink-0" />
          <div>
            <span className="font-semibold text-[var(--text-primary)]">{t('verifiedSnapshot')}</span>
            {new Date(pack.generatedAtTimestamp).toLocaleString()} ·{' '}
            <span className="text-[var(--text-secondary)]/80">
              {t('dynamicConditionsMarineSwell')}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--border-subtle)] bg-[var(--surface-container)] px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('itinerary')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition cursor-pointer ${
              activeTab === 'itinerary'
                ? 'border-[var(--accent-secondary)] text-[var(--accent-secondary)] font-semibold'
                : 'border-transparent text-[var(--text-secondary)]/60 hover:text-[var(--text-primary)]'
            }`}
          >
            {t('itineraryTrails')}
          </button>
          <button
            onClick={() => setActiveTab('vouchers')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition cursor-pointer ${
              activeTab === 'vouchers'
                ? 'border-[var(--accent-secondary)] text-[var(--accent-secondary)] font-semibold'
                : 'border-transparent text-[var(--text-secondary)]/60 hover:text-[var(--text-primary)]'
            }`}
          >
            {t('confirmedVouchers')} ({pack.confirmedBookings.length})
          </button>
          <button
            onClick={() => setActiveTab('emergency')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition cursor-pointer ${
              activeTab === 'emergency'
                ? 'border-[var(--accent-secondary)] text-[var(--accent-secondary)] font-semibold'
                : 'border-transparent text-[var(--text-secondary)]/60 hover:text-[var(--text-primary)]'
            }`}
          >
            {t('emergencyMedical')}
          </button>
          <button
            onClick={() => setActiveTab('checklist')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition cursor-pointer ${
              activeTab === 'checklist'
                ? 'border-[var(--accent-secondary)] text-[var(--accent-secondary)] font-semibold'
                : 'border-transparent text-[var(--text-secondary)]/60 hover:text-[var(--text-primary)]'
            }`}
          >
            {t('fieldPrepChecklist')}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* Traveler Quick Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[var(--surface-container)] p-4 rounded-2xl border border-[var(--border-subtle)] text-sm">
            <div>
              <span className="text-xs text-[var(--text-secondary)]/60 block">{t('primaryTraveler')}</span>
              <span className="font-semibold text-[var(--text-primary)]">{pack.traveler.name} ({pack.traveler.travelersCount} Travelers)</span>
            </div>
            <div>
              <span className="text-xs text-[var(--text-secondary)]/60 block">{t('accommodation')}</span>
              <span className="font-semibold text-[var(--text-primary)]">{pack.accommodation.hotelName}</span>
              <span className="text-xs text-[var(--text-secondary)]/70 block">{pack.accommodation.receptionPhone}</span>
            </div>
            <div>
              <span className="text-xs text-[var(--text-secondary)]/60 block">{t('masterTripCode')}</span>
              <span className="font-mono font-bold text-[var(--accent-secondary)]">{pack.tripId}</span>
            </div>
          </div>

          {/* Tab 1: Itinerary */}
          {activeTab === 'itinerary' && (
            <div className="space-y-4">
              {/* Dynamic Snapshot vs Static Logistics Card */}
              {pack.dynamicConditionsSnapshot && (
                <div className="bg-[var(--surface-container)] text-[var(--text-secondary)] p-4 rounded-2xl border border-[var(--border-subtle)] text-xs space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-[var(--accent-primary)] flex items-center gap-1.5">
                      <Wind className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      {t('dynamicConditionsSnapshot')}
                    </span>
                    <span className="bg-[var(--surface-card)] px-2 py-0.5 rounded text-[12px] font-mono text-[var(--accent-primary)] border border-[var(--border-subtle)]">
                      Observed: {new Date(pack.dynamicConditionsSnapshot.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({pack.dynamicConditionsSnapshot.freshness})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="bg-[var(--surface-card)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
                      <span className="text-[var(--accent-primary)] block text-[11px]">{t('windSpeed')}</span>
                      <span className="font-bold text-sm text-[var(--text-primary)]">{pack.dynamicConditionsSnapshot.windSpeedKnots} kts {pack.dynamicConditionsSnapshot.windDirection}</span>
                    </div>
                    <div className="bg-[var(--surface-card)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
                      <span className="text-[var(--accent-primary)] block text-[11px]">{t('seaState')}</span>
                      <span className="font-bold text-sm text-[var(--text-primary)]">{pack.dynamicConditionsSnapshot.seaState}</span>
                    </div>
                    <div className="bg-[var(--surface-card)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
                      <span className="text-[var(--accent-primary)] block text-[11px]">{t('visTemp')}</span>
                      <span className="font-bold text-sm text-[var(--text-primary)]">{pack.dynamicConditionsSnapshot.waterVisibilityMeters}m · {pack.dynamicConditionsSnapshot.waterTempC}°C</span>
                    </div>
                    <div className="bg-[var(--surface-card)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
                      <span className="text-[var(--accent-primary)] block text-[11px]">{t('sunsetAnchor')}</span>
                      <span className="font-bold text-sm text-[var(--accent-secondary)]">{pack.dynamicConditionsSnapshot.sunsetTimeStr}</span>
                    </div>
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)]/70 pt-1">
                    *{pack.dynamicConditionsSnapshot.disclaimer}
                  </p>
                </div>
              )}

              <h3 className=" font-bold text-lg text-[var(--text-primary)]">
                {t('staticDaybyDayRemoteLogistics')}
              </h3>
              <div className="space-y-3">
                {pack.itinerarySummary.map((day) => (
                  <div key={day.dayNumber} className="border border-[var(--border-subtle)] rounded-2xl p-4 bg-[var(--surface-container)] hover:border-white/20 transition">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-[var(--surface-card)] text-[var(--accent-primary)] text-xs font-bold px-2.5 py-1 rounded-md border border-[var(--border-subtle)]">
                          Day {day.dayNumber}
                        </span>
                        <span className="font-semibold text-[var(--text-primary)]">{day.theme}</span>
                      </div>
                      <span className="text-xs bg-[var(--surface-card)] text-[var(--text-secondary)] px-2.5 py-1 rounded-full border border-[var(--border-subtle)]">
                        {day.intensity}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[var(--text-secondary)] mt-3 pt-3 border-t border-[var(--border-subtle)]">
                      <div>
                        <span className="font-semibold text-[var(--text-primary)] block mb-1">
                          {t('anchorAccessMethod')}
                        </span>
                        <p className="text-[var(--text-secondary)]/75">{day.anchor} · {day.accessMethod}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--text-primary)] block mb-1">
                          {t('signalConnectivity')}
                        </span>
                        <p className="text-[var(--text-secondary)]/75">{day.connectivity}</p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 text-xs bg-[var(--surface-card)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
                      <span className="font-semibold text-[var(--accent-secondary)] block mb-1">
                        {t('fieldPreparationNotes')}
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-[var(--text-secondary)]/80">
                        {day.prepNotes.map((note, idx) => (
                          <li key={idx}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Vouchers */}
          {activeTab === 'vouchers' && (
            <div className="space-y-4">
              <h3 className=" font-bold text-lg text-[var(--text-primary)]">
                {t('offlinePrintableServiceVouchers')}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {pack.confirmedBookings.map((b, i) => (
                  <div key={i} className="border-2 border-dashed border-white/15 rounded-2xl p-5 bg-[var(--surface-container)] relative">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold text-[var(--accent-secondary)] bg-[var(--surface-card)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                          {b.type}
                        </span>
                        <h4 className="text-base font-bold text-[var(--text-primary)] mt-1">{b.title}</h4>
                        <p className="text-xs text-[var(--text-secondary)]/70">
                          {b.provider} · <span className="font-semibold text-[var(--text-primary)]">{b.departureTime}</span>
                        </p>
                      </div>
                      <div className="text-end">
                        <span className="text-xs text-[var(--text-secondary)]/60 block">{t('voucherCode')}</span>
                        <span className="font-mono font-bold text-base text-[var(--accent-secondary)] bg-[var(--surface-card)] px-2 py-1 rounded border border-[var(--border-subtle)]">
                          {b.code}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                      <div>
                        <span className="font-semibold text-[var(--text-primary)]">{t('meetingPoint')}</span>
                        {b.meetingPoint}
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--text-primary)]">{t('directProviderPhone')}</span>
                        <span className="font-mono text-[var(--accent-secondary)]">{b.phone}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Emergency */}
          {activeTab === 'emergency' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className=" font-bold text-lg text-[var(--text-primary)]">
                  {t('emergencyHyperbaricDirectoryVerified')}
                </h3>
                <span className="text-xs text-[var(--accent-primary)] bg-[var(--surface-container)] px-2.5 py-1 rounded-md border border-[var(--border-subtle)]">
                  {t('lastVerifiedAug25')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {(pack.emergencyResources || []).map((resource) => (
                  <div
                    key={resource.id}
                    className={`p-4 rounded-2xl border ${
                      resource.category === 'hyperbaric'
                        ? 'border-red-500/40 bg-red-950/40 text-red-100'
                        : resource.category === 'ambulance'
                        ? 'border-amber-500/40 bg-amber-950/40 text-amber-100'
                        : 'border-[var(--border-subtle)] bg-[var(--surface-container)] text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          resource.category === 'hyperbaric' ? 'bg-red-900/60 text-red-300' : 'bg-[var(--surface-card)] text-[var(--accent-primary)]'
                        }`}>
                          {resource.category.toUpperCase()} · {resource.status}
                        </span>
                        <h4 className="font-bold text-base mt-1.5">{language === 'ar' ? resource.nameAr : resource.name}</h4>
                      </div>
                    </div>

                    <div className="mt-2 font-mono font-bold text-base text-[var(--accent-secondary)] bg-[var(--surface-container)] px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] inline-block">
                      {resource.phone}
                    </div>

                    <p className="text-xs text-[var(--text-secondary)]/70 mt-2">
                      <MapPin className="w-3 h-3 inline me-1 text-[var(--accent-primary)]" />
                      {language === 'ar' ? resource.locationAr : resource.location}
                    </p>

                    <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium">
                      {language === 'ar' ? resource.notesAr : resource.notes}
                    </p>

                    <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]/50">
                      <span>Authority: {resource.owner}</span>
                      <span>Verified: {new Date(resource.verifiedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-[var(--surface-container)] rounded-2xl border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--accent-secondary)] shrink-0" />
                <span>
                  {t('noticeEmergencyContactNumbers')}
                </span>
              </div>
            </div>
          )}

          {/* Tab 4: Checklist */}
          {activeTab === 'checklist' && (
            <div className="space-y-4">
              <h3 className=" font-bold text-lg text-[var(--text-primary)]">
                {t('fieldPreparationPackingChecklist')}
              </h3>
              <div className="space-y-4">
                {pack.practicalChecklist.map((sec, idx) => (
                  <div key={idx} className="bg-[var(--surface-container)] border border-[var(--border-subtle)] rounded-2xl p-4">
                    <h4 className="font-semibold text-[var(--text-primary)] text-sm mb-2">{sec.category}</h4>
                    <ul className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                      {sec.items.map((it, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                          <span>{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-[var(--surface-container)] p-4 px-6 border-t border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-[var(--text-secondary)]/70">
            {t('saveThisDocumentOr')}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-white/15 bg-[var(--surface-container)] hover:bg-[var(--surface-card)]/10 text-[var(--text-primary)] transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              {t('printSavePDF')}
            </button>

            <button
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-[var(--accent-secondary)] hover:brightness-110 text-[var(--accent-primary-ink)] shadow-md transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {t('downloadOfflinePack')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

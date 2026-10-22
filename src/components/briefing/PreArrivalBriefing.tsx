import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  MapPin, 
  Calendar, 
  Users, 
  Plane, 
  Car, 
  Building, 
  Waves, 
  Check, 
  CheckCircle2, 
  Sun, 
  Wind, 
  Eye, 
  Luggage, 
  ShieldCheck, 
  HelpCircle, 
  Compass, 
  Clock, 
  AlertCircle,
  FileText,
  Copy,
  X,
  Phone,
  MessageSquare,
  ArrowRight,
  Info
} from 'lucide-react';
import { ConfirmedBookingItem, AHMED_BOOKINGS } from '../mytrip/myTripData';
import { api } from '../../services/api';

interface PreArrivalBriefingProps {
  onBackToMyTrip: () => void;
  onReadyConfirmed: () => void;
  onOpenHelp?: () => void;
}

export const PreArrivalBriefing: React.FC<PreArrivalBriefingProps> = ({
  onBackToMyTrip,
  onReadyConfirmed,
  onOpenHelp,
}) => {
  // Modal states for detail inspection
  const [detailModal, setDetailModal] = useState<{
    type: 'transfer' | 'hotel' | 'diving' | 'checklist' | 'help' | null;
  }>({ type: null });

  // Regulations fetched from backend
  interface RegulationItem { id: string; titleEn: string; titleAr: string; descriptionEn: string; descriptionAr: string; authority: string; effectiveDate: string; }
  const [regulations, setRegulations] = useState<RegulationItem[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    api.getRegulations(controller.signal)
      .then((data) => {
        if (data.regulations?.length) {
          setRegulations((data.regulations as RegulationItem[]).slice(0, 5));
        }
      })
      .catch(() => {
        // No-op — static content already shows
      });
    return () => controller.abort();
  }, []);

  // Confirmation state for "I'm Ready"
  const [isReadyModalOpen, setIsReadyModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleImReadyClick = () => {
    setIsReadyModalOpen(true);
  };

  const handleFinishReady = () => {
    setIsReadyModalOpen(false);
    onReadyConfirmed();
  };

  const checklistItems = [
    { title: 'Swimwear', note: 'Essential for Dahab reefs & beach lagunas' },
    { title: 'Comfortable walking shoes', note: 'For canyon treks & cobblestone promenades' },
    { title: 'Sunscreen', note: 'Reef-safe formula recommended for coral preservation' },
    { title: 'Sunglasses & hat', note: 'Sinai sunshine is bright throughout the day' },
    { title: 'Light clothing', note: 'Breathable daytime wear + 1 light evening layer' },
    { title: 'Water bottle', note: 'Stay hydrated during airport transfer & outings' },
    { title: 'ID / required documents', note: 'Passports & diving credentials (digital or physical)' },
  ];

  return (
    <div className="min-h-screen bg-[var(--surface-card)] text-[var(--text-primary)] flex flex-col pb-28 md:pb-16 selection:bg-[var(--accent-secondary)]/20">
      {/* 1. TOP MINIMAL NAVIGATION BAR */}
      <header className="bg-[var(--surface-card)]/95 border-b border-[var(--border-subtle)] sticky top-0 z-40 shadow-md backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              id="briefing-back-nav-btn"
              onClick={onBackToMyTrip}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-xs font-bold text-[var(--text-primary)] transition-colors cursor-pointer border border-[var(--border-subtle)]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to My Trip</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-[var(--border-subtle)]">
              <span className="text-xs font-bold text-[var(--accent-primary)]">
                Pre-Arrival Briefing
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]"></span>
              <span className="text-xs text-[var(--text-secondary)]/60 font-medium">T-24 Hours</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-full">
              <div className="w-5 h-5 rounded-full bg-[var(--surface-container)] text-[var(--accent-secondary)] text-[11px] font-bold flex items-center justify-center border border-[var(--border-subtle)]">
                A
              </div>
              <span className="text-xs font-bold text-[var(--text-primary)]">Ahmed</span>
              <span className="text-[11px] font-bold text-[var(--surface-card)] bg-[var(--accent-secondary)] px-1.5 py-0.2 rounded-full">
                Tomorrow
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full flex-grow">
        {/* PAGE HEADER */}
        <div className="space-y-4 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--border-subtle)] text-xs font-bold shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              <span>Personal Travel Briefing · Ahmed</span>
            </div>

            {/* Compact Countdown Indicator */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface-container)] text-[var(--accent-secondary)] border border-[var(--border-subtle)] text-xs font-bold">
              <Clock className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              <span>Starts tomorrow</span>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] tracking-tight">
              Tomorrow in Dahab
            </h1>
            <p className="text-base sm:text-lg text-[var(--text-secondary)]/80 max-w-2xl font-medium">
              Your trip starts tomorrow. Here's everything you need before you go.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-[var(--text-secondary)]/70 pt-1">
            <span className="font-bold text-[var(--text-primary)] bg-[var(--surface-card)] border border-[var(--border-subtle)] px-3 py-1 rounded-full shadow-xs">
              Dahab · 5 Days · 2 Travelers
            </span>
            <span className="text-[var(--text-secondary)]/30">•</span>
            <span className="flex items-center gap-1 font-semibold text-[var(--accent-primary)] bg-[var(--surface-container)] px-2.5 py-1 rounded-full border border-[var(--border-subtle)]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>All 4 Services Confirmed ✓</span>
            </span>
          </div>
        </div>

        {/* 2-COLUMN DESKTOP / 1-COLUMN MOBILE LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ============================================================ */}
          {/* MAIN COLUMN (7/12 on Desktop) */}
          {/* ============================================================ */}
          <div className="lg:col-span-7 space-y-6">

            {/* 1. ARRIVAL OVERVIEW (Prominent "Tomorrow" Card) */}
            <section 
              id="briefing-arrival-section"
              className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-lg space-y-5 relative overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] text-[var(--accent-secondary)] flex items-center justify-center font-bold border border-[var(--border-subtle)]">
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                      Tomorrow's Journey
                    </span>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">
                      Your arrival
                    </h2>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--surface-container)] text-[var(--accent-primary)] text-xs font-bold border border-[var(--border-subtle)]">
                  <Check className="w-3.5 h-3.5 text-[var(--accent-primary)] stroke-[2.5]" />
                  <span>Driver Assigned</span>
                </span>
              </div>

              {/* Arrival details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[var(--text-secondary)]/60 font-semibold flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Arrival Point</span>
                  </span>
                  <p className="font-bold text-[var(--text-primary)] text-sm">
                    Sharm El Sheikh International Airport (SSH)
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[var(--text-secondary)]/60 font-semibold flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Transfer Vehicle</span>
                  </span>
                  <p className="font-bold text-[var(--text-primary)] text-sm">
                    Private Car (Air-Conditioned Sedan)
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[var(--text-secondary)]/60 font-semibold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Destination in Dahab</span>
                  </span>
                  <p className="font-bold text-[var(--text-primary)] text-sm">
                    Dahab Bay Hotel (Lighthouse Area)
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[var(--text-secondary)]/60 font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Pickup & Timing</span>
                  </span>
                  <p className="font-bold text-[var(--text-primary)] text-sm">
                    Arrival Area · Approx. 1 hour drive
                  </p>
                </div>
              </div>

              {/* Reassuring note & View transfer details button */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--border-subtle)]">
                <p className="text-xs text-[var(--text-secondary)]/70 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0" />
                  <span>Flight MS 304 tracked live · No extra charge for delays</span>
                </p>

                <button
                  type="button"
                  id="view-transfer-details-btn"
                  onClick={() => setDetailModal({ type: 'transfer' })}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] text-xs font-bold text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                  <span>View transfer details</span>
                </button>
              </div>
            </section>

            {/* 2. HOTEL CHECK-IN ("Your stay") */}
            <section 
              id="briefing-hotel-section"
              className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-lg space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] text-[var(--accent-primary)] flex items-center justify-center font-bold border border-[var(--border-subtle)]">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                      Accommodation
                    </span>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">
                      Your stay
                    </h2>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--surface-container)] text-[var(--accent-primary)] text-xs font-bold border border-[var(--border-subtle)]">
                  <Check className="w-3.5 h-3.5 text-[var(--accent-primary)] stroke-[2.5]" />
                  <span>Confirmed ✓</span>
                </span>
              </div>

              {/* Hotel Information Card */}
              <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs text-[var(--accent-primary)] font-bold">
                      Selected Hotel
                    </span>
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">
                      Dahab Bay Hotel
                    </h3>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]/60 font-semibold">
                    Oct 12 – Oct 17 · 5 nights
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs pt-1">
                  <div className="bg-[var(--surface-card)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-secondary)]/60 block font-medium">Check-in</span>
                    <span className="font-bold text-[var(--text-primary)] text-sm">3:00 PM</span>
                  </div>

                  <div className="bg-[var(--surface-card)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-secondary)]/60 block font-medium">Check-out</span>
                    <span className="font-bold text-[var(--text-primary)] text-sm">11:00 AM</span>
                  </div>

                  <div className="bg-[var(--surface-card)] p-2.5 rounded-xl border border-[var(--border-subtle)] col-span-2 sm:col-span-1">
                    <span className="text-[var(--text-secondary)]/60 block font-medium">Room Type</span>
                    <span className="font-bold text-[var(--text-primary)] text-sm truncate block">
                      Sea View Deluxe
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed pt-1">
                  Arriving earlier than 3:00 PM? You can leave your bags securely with the front desk concierge and start exploring the Lighthouse promenade immediately.
                </p>
              </div>

              {/* View hotel details */}
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  id="view-hotel-details-btn"
                  onClick={() => setDetailModal({ type: 'hotel' })}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent-secondary)] hover:text-[var(--accent-secondary)] underline underline-offset-4 cursor-pointer py-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View hotel details</span>
                </button>
              </div>
            </section>

            {/* 3. FIRST ACTIVITY ("Your first experience") */}
            <section 
              id="briefing-activity-section"
              className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-lg space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] text-[var(--accent-primary)] flex items-center justify-center font-bold border border-[var(--border-subtle)]">
                    <Waves className="w-4 h-4 text-[var(--accent-primary)]" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                      First Adventure
                    </span>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">
                      Your first experience
                    </h2>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--surface-container)] text-[var(--accent-primary)] text-xs font-bold border border-[var(--border-subtle)]">
                  <Check className="w-3.5 h-3.5 text-[var(--accent-primary)] stroke-[2.5]" />
                  <span>Confirmed ✓</span>
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-[var(--accent-primary)] bg-[var(--surface-card)] px-2 py-0.5 rounded-full inline-block mb-1 border border-[var(--border-subtle)]">
                      Day 2 · 09:00 AM
                    </span>
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">
                      Guided Diving Experience
                    </h3>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]/60 font-semibold">
                    Canyon & Blue Hole Reefs
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[var(--text-secondary)]/80 leading-relaxed font-medium">
                  Your diving experience is already part of your trip. Full premium gear, tank fills, and master guide briefing are reserved under Ahmed.
                </p>

                <div className="pt-1 flex items-center justify-between border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]/70">
                  <span>Provider: Red Sea Explorers Dahab</span>
                  <button
                    type="button"
                    id="view-activity-details-btn"
                    onClick={() => setDetailModal({ type: 'diving' })}
                    className="font-bold text-[var(--accent-secondary)] hover:text-[var(--accent-secondary)] underline underline-offset-4 cursor-pointer"
                  >
                    View activity
                  </button>
                </div>
              </div>
            </section>

            {/* 4. WHAT TO BRING (Concise Checklist) */}
            <section 
              id="briefing-what-to-bring-section"
              className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-lg space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] text-[var(--accent-primary)] flex items-center justify-center font-bold border border-[var(--border-subtle)]">
                    <Luggage className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                      Packing Essentials
                    </span>
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">
                      What to bring
                    </h2>
                  </div>
                </div>

                <span className="text-xs text-[var(--text-secondary)]/60 font-medium">
                  7 items
                </span>
              </div>

              {/* Concise check grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {checklistItems.map((item, idx) => (
                  <div 
                    key={idx}
                    className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-start gap-2.5"
                  >
                    <div className="w-5 h-5 rounded-full bg-[var(--surface-card)] text-[var(--accent-primary)] flex items-center justify-center flex-shrink-0 mt-0.5 border border-[var(--border-subtle)]">
                      <Check className="w-3 h-3 text-[var(--accent-primary)] stroke-[2.5]" />
                    </div>
                    <div>
                      <span className="font-bold text-[var(--text-primary)] block">{item.title}</span>
                      <span className="text-[12px] text-[var(--text-secondary)]/60">{item.note}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-between items-center text-xs">
                <span className="text-[var(--text-secondary)]/60">Compact guide for 5-day stay</span>
                <button
                  type="button"
                  id="view-full-checklist-btn"
                  onClick={() => setDetailModal({ type: 'checklist' })}
                  className="font-bold text-[var(--accent-secondary)] hover:text-[var(--accent-secondary)] underline underline-offset-4 cursor-pointer"
                >
                  View full checklist
                </button>
              </div>
            </section>

            {/* 5. ARRIVAL INSTRUCTIONS (3-Step Visual Guide) */}
            <section 
              id="briefing-arrival-steps-section"
              className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-lg space-y-4"
            >
              <div className="border-b border-[var(--border-subtle)] pb-3.5">
                <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                  Arrival Flow
                </span>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  Arrival instructions
                </h2>
                <p className="text-xs text-[var(--text-secondary)]/70 mt-0.5">
                  Three simple steps when you touch down in South Sinai
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                {/* Step 1 */}
                <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-2 relative">
                  <div className="w-8 h-8 rounded-full bg-[var(--surface-card)] text-[var(--accent-secondary)] flex items-center justify-center font-bold text-sm border border-[var(--border-subtle)]">
                    01
                  </div>
                  <h3 className="font-bold text-sm text-[var(--text-primary)]">
                    Arrive at Sharm El Sheikh Airport
                  </h3>
                  <p className="text-[var(--text-secondary)]/70 text-[12px] leading-relaxed">
                    Disembark flight MS 304 and proceed through the terminal building.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-2 relative">
                  <div className="w-8 h-8 rounded-full bg-[var(--surface-card)] text-[var(--accent-secondary)] flex items-center justify-center font-bold text-sm border border-[var(--border-subtle)]">
                    02
                  </div>
                  <h3 className="font-bold text-sm text-[var(--text-primary)]">
                    Collect your luggage
                  </h3>
                  <p className="text-[var(--text-secondary)]/70 text-[12px] leading-relaxed">
                    Retrieve your bags from baggage claim and exit to the arrivals hall.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-2 relative">
                  <div className="w-8 h-8 rounded-full bg-[var(--surface-card)] text-[var(--accent-secondary)] flex items-center justify-center font-bold text-sm border border-[var(--border-subtle)]">
                    03
                  </div>
                  <h3 className="font-bold text-sm text-[var(--text-primary)]">
                    Meet your transfer driver
                  </h3>
                  <p className="text-[var(--text-secondary)]/70 text-[12px] leading-relaxed">
                    Look for the driver holding a "Dahab – Ahmed" welcome sign at the exit.
                  </p>
                </div>
              </div>

              {/* Concluding reassurance */}
              <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center gap-2.5 text-xs text-[var(--accent-primary)] font-bold">
                <Sparkles className="w-4 h-4 flex-shrink-0 text-[var(--accent-secondary)]" />
                <span>You'll be on your way to Dahab within minutes of meeting your driver.</span>
              </div>
            </section>

            {/* 6. IMPORTANT THINGS TO KNOW ("Before you arrive") */}
            <section 
              id="briefing-important-info-section"
              className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-lg space-y-4"
            >
              <div className="border-b border-[var(--border-subtle)] pb-3.5">
                <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                  Helpful Knowledge
                </span>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  Before you arrive
                </h2>
                <p className="text-xs text-[var(--text-secondary)]/70 mt-0.5">
                  Key pointers for a smooth transition into Dahab rhythm
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Card 1: Check-in */}
                <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                  <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
                    <Building className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <h4>Check-in</h4>
                  </div>
                  <p className="text-[var(--text-secondary)]/75 leading-relaxed">
                    Your hotel check-in starts at 3:00 PM. Luggage storage is available if you arrive earlier.
                  </p>
                </div>

                {/* Card 2: Transfer */}
                <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                  <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
                    <Car className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <h4>Transfer</h4>
                  </div>
                  <p className="text-[var(--text-secondary)]/75 leading-relaxed">
                    Your driver will meet you at the agreed pickup point right outside the arrivals gate.
                  </p>
                </div>

                {/* Card 3: Diving */}
                <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                  <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
                    <Waves className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <h4>Diving</h4>
                  </div>
                  <p className="text-[var(--text-secondary)]/75 leading-relaxed">
                    Bring comfortable clothes, swimwear, and arrive a little early for equipment fitting.
                  </p>
                </div>

                {/* Card 4: Cash */}
                <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                  <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
                    <Info className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                    <h4>Cash & Payments</h4>
                  </div>
                  <p className="text-[var(--text-secondary)]/75 leading-relaxed">
                    Some local places and Bedouin tea huts may prefer cash (EGP). ATMs are available along the promenade.
                  </p>
                </div>
              </div>
            </section>

          </div>

          {/* ============================================================ */}
          {/* SECONDARY SUPPORTING COLUMN (5/12 on Desktop) */}
          {/* ============================================================ */}
          <div className="lg:col-span-5 space-y-6">

            {/* 1. TRIP CHANGES / REASSURANCE NOTIFICATION AREA */}
            <div 
              id="briefing-changes-status-card"
              className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-lg space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-[var(--accent-primary)]">
                  Trip Updates
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--surface-container)] text-[var(--accent-primary)] text-[12px] font-bold border border-[var(--border-subtle)]">
                  <Check className="w-3 h-3 text-[var(--accent-primary)] stroke-[2.5]" />
                  <span>Real-Time Sync</span>
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Any changes?
                </h3>
                <p className="text-sm font-bold text-[var(--accent-primary)] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0" />
                  <span>Everything is on track ✓</span>
                </p>
                <p className="text-xs text-[var(--text-secondary)]/75 leading-relaxed pt-1">
                  Your hotel, transfer, and activities are confirmed and ready. If anything shifts, we will alert you immediately here.
                </p>
              </div>
            </div>

            {/* 2. DAHAB TOMORROW (Weather & Conditions Preview) */}
            <div 
              id="briefing-weather-conditions-card"
              className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-lg space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div>
                  <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                    Forecast Preview
                  </span>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">
                    Dahab tomorrow
                  </h3>
                </div>

                <span className="text-[11px] font-bold text-[var(--text-secondary)]/60 bg-[var(--surface-container)] px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">
                  Prototype Preview
                </span>
              </div>

              {/* 4 Conditions Cards */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[var(--text-secondary)]/60 flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                    <span>Temperature</span>
                  </span>
                  <p className="font-bold text-[var(--text-primary)] text-sm">Warm (28°C)</p>
                </div>

                <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[var(--text-secondary)]/60 flex items-center gap-1">
                    <Wind className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Wind</span>
                  </span>
                  <p className="font-bold text-[var(--text-primary)] text-sm">Moderate breeze</p>
                </div>

                <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[var(--text-secondary)]/60 flex items-center gap-1">
                    <Waves className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Sea conditions</span>
                  </span>
                  <p className="font-bold text-[var(--text-primary)] text-sm">Calm sea</p>
                </div>

                <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[var(--text-secondary)]/60 flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Visibility</span>
                  </span>
                  <p className="font-bold text-[var(--text-primary)] text-sm">Good visibility</p>
                </div>
              </div>

              <p className="text-[12px] text-[var(--text-secondary)]/50 italic">
                *Example conditions for travel preparation. Ideal conditions for coastal arrival and light strolling.
              </p>
            </div>

            {/* 3. QUICK ACTIONS SHORTCUTS */}
            <div 
              id="briefing-quick-actions-card"
              className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-lg space-y-3.5"
            >
              <div className="border-b border-[var(--border-subtle)] pb-2.5">
                <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                  Shortcuts
                </span>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Quick actions
                </h3>
              </div>

              <div className="space-y-2 text-xs">
                <button
                  type="button"
                  id="quick-action-view-mytrip"
                  onClick={onBackToMyTrip}
                  className="w-full p-3 rounded-2xl bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] font-bold text-[var(--text-primary)] flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>View My Trip</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-secondary)]/40" />
                </button>

                <button
                  type="button"
                  id="quick-action-transfer-details"
                  onClick={() => setDetailModal({ type: 'transfer' })}
                  className="w-full p-3 rounded-2xl bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] font-bold text-[var(--text-primary)] flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Car className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Transfer Details</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-secondary)]/40" />
                </button>

                <button
                  type="button"
                  id="quick-action-hotel-details"
                  onClick={() => setDetailModal({ type: 'hotel' })}
                  className="w-full p-3 rounded-2xl bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] font-bold text-[var(--text-primary)] flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Hotel Details</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-secondary)]/40" />
                </button>

                <button
                  type="button"
                  id="quick-action-help-me-now"
                  onClick={() => setDetailModal({ type: 'help' })}
                  className="w-full p-3 rounded-2xl bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] font-bold text-rose-300 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Help Me Now</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-rose-400/50" />
                </button>
              </div>
            </div>

            {/* 4. PRIMARY CTA BOX (Desktop Primary Action) */}
            <div 
              id="briefing-primary-cta-card"
              className="bg-[var(--surface-card)] text-[var(--text-primary)] rounded-3xl p-6 shadow-xl space-y-3.5 border border-[var(--border-subtle)]"
            >
              <div className="space-y-1">
                <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                  Ready to go?
                </span>
                <h3 className="text-xl font-bold text-[var(--text-primary)]">
                  Confirm your briefing
                </h3>
                <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed">
                  Let us know you've reviewed the arrival essentials and are ready for tomorrow.
                </p>
              </div>

              <button
                type="button"
                id="im-ready-desktop-btn"
                onClick={handleImReadyClick}
                className="w-full py-3.5 px-5 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold text-sm shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Check className="w-4 h-4 text-[var(--surface-card)] stroke-[2.5]" />
                <span>I'm Ready</span>
              </button>
            </div>

            {/* 5. SUPPORT (Need help before you leave?) */}
            <div 
              id="briefing-support-secondary-card"
              className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xs space-y-3"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] text-[var(--accent-primary)] flex items-center justify-center flex-shrink-0 border border-[var(--border-subtle)]">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Need help before you leave?
                  </h3>
                  <p className="text-[12px] text-[var(--text-secondary)]/65">
                    Something unclear about your hotel, transfer, or activities?
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="briefing-support-help-btn"
                onClick={() => setDetailModal({ type: 'help' })}
                className="w-full py-2.5 px-4 rounded-full bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] text-xs font-bold text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Help Me Now</span>
              </button>
            </div>

            {/* 6. LOCAL REGULATIONS */}
            {regulations.length > 0 && (
              <div
                id="briefing-regulations-card"
                className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xs space-y-3"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] text-[var(--accent-secondary)] flex items-center justify-center flex-shrink-0 border border-[var(--border-subtle)]">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Local Regulations</h3>
                    <p className="text-[11px] text-[var(--text-secondary)]/60">Official directives for South Sinai</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {regulations.map((reg) => (
                    <div key={reg.id} className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                      <span className="font-bold text-[11px] text-[var(--accent-secondary)] block">{reg.titleEn}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]/70 leading-relaxed block line-clamp-2">{reg.descriptionEn}</span>
                      <span className="text-[9px] text-[var(--text-secondary)]/40">{reg.authority} · {reg.effectiveDate}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* STICKY BOTTOM BAR ON MOBILE ("I'm Ready") */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-card)]/95 backdrop-blur-lg border-t border-[var(--border-subtle)] p-3 shadow-xl flex items-center gap-3">
        <button
          type="button"
          id="im-ready-mobile-sticky-btn"
          onClick={handleImReadyClick}
          className="w-full py-3 px-5 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold text-sm shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-2 cursor-pointer"
        >
          <Check className="w-4 h-4 text-[var(--surface-card)] stroke-[2.5]" />
          <span>I'm Ready</span>
        </button>
      </div>

      {/* TOAST MESSAGE */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full bg-[var(--surface-card)] text-[var(--text-primary)] text-xs font-bold shadow-xl border border-[var(--border-subtle)] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 text-[var(--accent-primary)]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. "I'M READY" CONFIRMATION MODAL STATE */}
      {/* ============================================================ */}
      {isReadyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pre-arrival-briefing-dialog-1-title"
    >
          <div 
            className="bg-[var(--surface-card)] rounded-3xl max-w-md w-full p-6 sm:p-8 border border-[var(--border-subtle)] shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-16 h-16 rounded-full bg-[var(--surface-container)] text-[var(--accent-primary)] flex items-center justify-center mx-auto shadow-xs border border-[var(--border-subtle)]">
              <Check className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <h3 id="pre-arrival-briefing-dialog-1-title" className="text-2xl font-bold text-[var(--text-primary)]">
                You're all set, Ahmed ✓
              </h3>
              <p className="text-sm text-[var(--text-secondary)]/80 leading-relaxed font-medium">
                We'll see you in Dahab tomorrow. Your driver will track flight MS 304 and wait at the arrivals area.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]/80 text-start space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[var(--accent-primary)]">
                <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Next Milestone: Airport Arrival in SSH</span>
              </div>
              <p>Everything is coordinated. Open My Trip whenever you land to access live assistance.</p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                id="finish-ready-btn"
                onClick={handleFinishReady}
                className="w-full py-3.5 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold text-sm shadow-xs transition-colors cursor-pointer"
              >
                Return to My Trip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. TRANSFER DETAILS MODAL */}
      {/* ============================================================ */}
      {detailModal.type === 'transfer' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pre-arrival-briefing-dialog-2-title"
    >
          <div className="bg-[var(--surface-card)] rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-primary)]">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] text-[var(--accent-primary)] flex items-center justify-center border border-[var(--border-subtle)]">
                  <Car className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                    Transport Service
                  </span>
                  <h3 id="pre-arrival-briefing-dialog-2-title" className="text-lg font-bold text-[var(--text-primary)]">
                    Transfer Details
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModal({ type: null })}
                className="w-8 h-8 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <span className="font-bold text-[var(--text-primary)] block">Assigned Transport Provider</span>
                <p className="text-[var(--text-secondary)]/70">Sinai Comfort Transport · Ref: SCT-304-PVT</p>
                <p className="text-[var(--text-secondary)]/70">Vehicle: Toyota Corolla / Sedan (Air-Conditioned)</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <span className="font-bold text-[var(--text-primary)] block">Meeting Point & Instructions</span>
                <p className="text-[var(--text-secondary)]/70">Driver will wait right outside Terminal 1 arrival gate holding a sign with "DAHAB – AHMED".</p>
                <p className="text-[var(--text-secondary)]/70">Estimated drive: 1 hour 15 mins via scenic South Sinai coastal highway.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDetailModal({ type: null })}
              className="w-full py-3 rounded-full bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] text-[var(--text-primary)] font-bold text-xs cursor-pointer border border-[var(--border-subtle)]"
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. HOTEL DETAILS MODAL */}
      {/* ============================================================ */}
      {detailModal.type === 'hotel' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pre-arrival-briefing-dialog-3-title"
    >
          <div className="bg-[var(--surface-card)] rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-primary)]">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] text-[var(--accent-primary)] flex items-center justify-center border border-[var(--border-subtle)]">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                    Accommodation
                  </span>
                  <h3 id="pre-arrival-briefing-dialog-3-title" className="text-lg font-bold text-[var(--text-primary)]">
                    Dahab Bay Hotel
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModal({ type: null })}
                className="w-8 h-8 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <span className="font-bold text-[var(--text-primary)] block">Reservation Reference</span>
                <p className="font-mono font-bold text-[var(--accent-secondary)]">DBH-8942-ROOM · Confirmed ✓</p>
                <p className="text-[var(--text-secondary)]/70">5 nights (Oct 12 – 17) · Sea View Deluxe Room · 2 Guests</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <span className="font-bold text-[var(--text-primary)] block">Location & Front Desk</span>
                <p className="text-[var(--text-secondary)]/70">Lighthouse Promenade, Dahab, South Sinai</p>
                <p className="text-[var(--text-secondary)]/70">24/7 reception desk · Complimentary luggage storage on early arrival</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDetailModal({ type: null })}
              className="w-full py-3 rounded-full bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] text-[var(--text-primary)] font-bold text-xs cursor-pointer border border-[var(--border-subtle)]"
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. DIVING DETAILS MODAL */}
      {/* ============================================================ */}
      {detailModal.type === 'diving' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pre-arrival-briefing-dialog-4-title"
    >
          <div className="bg-[var(--surface-card)] rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-primary)]">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] text-[var(--accent-primary)] flex items-center justify-center border border-[var(--border-subtle)]">
                  <Waves className="w-4 h-4 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                    Day 2 Activity
                  </span>
                  <h3 id="pre-arrival-briefing-dialog-4-title" className="text-lg font-bold text-[var(--text-primary)]">
                    Guided Diving Experience
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModal({ type: null })}
                className="w-8 h-8 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <span className="font-bold text-[var(--text-primary)] block">Booking Code: RSE-DIVE-299</span>
                <p className="text-[var(--text-secondary)]/70">Schedule: Day 2 (Oct 13) at 09:00 AM · Meeting at Red Sea Explorers</p>
                <p className="text-[var(--text-secondary)]/70">Includes: 2 guided reef dives, BCD, wetsuit, regulator, tank fills & certified master dive guide.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDetailModal({ type: null })}
              className="w-full py-3 rounded-full bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] text-[var(--text-primary)] font-bold text-xs cursor-pointer border border-[var(--border-subtle)]"
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. FULL CHECKLIST MODAL */}
      {/* ============================================================ */}
      {detailModal.type === 'checklist' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pre-arrival-briefing-dialog-5-title"
    >
          <div className="bg-[var(--surface-card)] rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto text-[var(--text-primary)]">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] text-[var(--accent-primary)] flex items-center justify-center border border-[var(--border-subtle)]">
                  <Luggage className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-[var(--accent-primary)] block">
                    Packing Companion
                  </span>
                  <h3 id="pre-arrival-briefing-dialog-5-title" className="text-lg font-bold text-[var(--text-primary)]">
                    Full Packing Checklist
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModal({ type: null })}
                className="w-8 h-8 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {checklistItems.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[var(--accent-primary)] mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-[var(--text-primary)] block">{item.title}</span>
                    <span className="text-[var(--text-secondary)]/65">{item.note}</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setDetailModal({ type: null })}
              className="w-full py-3 rounded-full bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] text-[var(--text-primary)] font-bold text-xs cursor-pointer border border-[var(--border-subtle)]"
            >
              Done Reviewing
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. HELP ME NOW MODAL */}
      {/* ============================================================ */}
      {detailModal.type === 'help' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pre-arrival-briefing-dialog-6-title"
    >
          <div className="bg-[var(--surface-card)] rounded-3xl max-w-md w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-primary)]">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-950 text-rose-300 flex items-center justify-center border border-rose-500/30">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-black text-rose-400 block">
                    Traveler Care
                  </span>
                  <h3 id="pre-arrival-briefing-dialog-6-title" className="text-lg font-bold text-[var(--text-primary)]">
                    Help Me Now
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModal({ type: null })}
                className="w-8 h-8 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[var(--text-secondary)]/75 leading-relaxed">
                Need to notify us about a delayed flight, update passenger details, or ask a question before tomorrow?
              </p>
              <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <span className="font-bold text-[var(--text-primary)] block">24/7 Dahab Concierge Line</span>
                <p className="text-[var(--text-secondary)]/70">WhatsApp / Phone: +20 100 894 2000</p>
                <p className="text-[var(--text-secondary)]/70">Support Reference: —</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                showToast('Concierge notified. A support agent will assist you shortly.');
                setDetailModal({ type: null });
              }}
              className="w-full py-3 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold text-xs cursor-pointer"
            >
              Send Concierge Message
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useCallback } from 'react';
import { 
  CheckCircle2, 
  Star, 
  Sparkles, 
  FileText, 
  Download, 
  Heart, 
  ArrowRight, 
  MapPin, 
  Waves, 
  Compass, 
  Calendar, 
  Share2, 
  MessageSquare,
  ThumbsUp,
  RotateCcw,
  Camera,
  Award
} from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { CategoryIcon, type CategoryKind } from '../common/CategoryIcon';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';

export const PostTripView: React.FC = () => {
  const { profile, user, navigateTo, showToast, activeTrip, activeTripItems, bookings } = useTrip();
  const { language, isRTL, t } = useLanguage();

  const travelerName = profile.name || user?.displayName || (t('departure.traveler'));

  /**
   * The feedback form starts empty.
   *
   * It used to open with five stars already selected, a favourite experience
   * already chosen ("Diving at The Canyon & Blue Hole") and a written review
   * already in the box: "The dive master was incredible and the Bedouin dinner
   * under the Sinai stars was unforgettable." A traveler who pressed submit
   * without reading published an opinion they had never expressed, about
   * experiences they may not have had.
   */
  const [rating, setRating] = useState<number>(0);
  const [favoriteExperience, setFavoriteExperience] = useState<string>('');
  const [feedbackNotes, setFeedbackNotes] = useState<string>('');
  const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState<boolean>(false);

  /**
   * Where the traveler actually went, from their own itinerary.
   *
   * This was six hardcoded place names — The Canyon, Blue Hole, Wadi Gnai,
   * Lighthouse, Assalah souk, Mashraba — presented as somewhere they had been,
   * on a page that opens "here is a summary of your experiences".
   */
  const placesVisited = Array.from(
    new Map(
      activeTripItems
        .filter(item => item.status === 'CONFIRMED' || item.status === 'BOOKED')
        .map(item => [
          item.supplier?.area || item.title,
          { en: item.supplier?.area || item.title, ar: item.supplier?.area || item.title }
        ])
    ).values()
  );

  /**
   * Empty.
   *
   * This was four Unsplash stock photographs — "Canyon Reef Dive", "Sinai
   * Desert Sunset", "Lighthouse Bay Afternoon", "Bedouin Tea Ceremony" —
   * displayed under "your trip highlights and memories". They were not the
   * traveler's photographs, of their trip, and nothing in this platform stores
   * a traveler photo. Until something does, the section says so.
   */
  const photoMemories: { title: string; titleAr: string; image: string; tag: string; tagAr: string }[] = [];

  const handleSubmitFeedback = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      showToast(t('postTrip.pleaseSelectARating'));
      return;
    }
    try {
      const feedbackText = [
        `Trip Rating: ${rating}/5`,
        favoriteExperience ? `Favorite: ${favoriteExperience}` : '',
        feedbackNotes ? `Notes: ${feedbackNotes}` : '',
      ].filter(Boolean).join('\n');
      await api.sendSupportMessage({
        message: feedbackText,
        category: 'trip_feedback',
        tripId: activeTrip?.id,
      });
      setIsFeedbackSubmitted(true);
      showToast(
        t('postTrip.thankYouForSharing')
      );
    } catch {
      // Offline or failed — still mark as submitted locally
      setIsFeedbackSubmitted(true);
      showToast(
        t('postTrip.thanksYourFeedbackWas')
      );
    }
  }, [rating, favoriteExperience, feedbackNotes, activeTrip, language, showToast]);

  return (
    <div 
      id="post-trip-view" 
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--surface-card)] text-[var(--text-primary)] pb-24"
    >
      {/* 1. Header Hero */}
      <section className="bg-[var(--surface-card)] border-b border-[var(--border-subtle)] text-white pt-12 pb-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('postTrip.tripStatusCompleted')}</span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[var(--text-primary)] tracking-tight text-balance">
                {t('postTrip.welcomeBack', { travelerName })}
              </h1>
              <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-2xl font-medium leading-relaxed">
                {activeTrip
                  ? t('postTrip.tripSummaryWithDays', { lengthDays: activeTrip.lengthDays })
                  : t('postTrip.tripSummaryGeneric')}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => showToast(t('postTrip.tripLinkPhotoAlbum'))}
                className="px-4 py-2.5 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-[var(--text-primary)] text-xs font-bold flex items-center gap-1.5 border border-[var(--border-subtle)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{t('postTrip.shareTrip')}</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('/trip-builder')}
                className="px-5 py-2.5 rounded-full bg-[var(--accent-secondary)] hover:bg-amber-300 text-[var(--surface-card)] text-xs font-bold flex items-center gap-1.5 shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('postTrip.planAnotherTrip')}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Main Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-xs space-y-1">
            <span className="text-[11px] font-black text-[var(--text-secondary)]/60 block">
              {t('itinerary.tripDuration')}
            </span>
            <div className="text-2xl chart-heading font-bold text-[var(--text-primary)]">
              {activeTrip
                ? t('postTrip.daysLabel', { lengthDays: activeTrip.lengthDays })
                : '—'}
            </div>
            <span className="text-xs text-[var(--text-secondary)]/70 font-medium">
              {t('postTrip.oct12Oct16')}
            </span>
          </div>

          <div className="p-5 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-xs space-y-1">
            <span className="text-[11px] font-black text-[var(--text-secondary)]/60 block">
              {t('postTrip.bookedServices')}
            </span>
            <div className="text-2xl chart-heading font-bold text-[var(--accent-secondary)]">
              {t('postTrip.4Services')}
            </div>
            <span className="text-xs text-emerald-400 font-bold">
              {t('postTrip.100Completed')}
            </span>
          </div>

          <div className="p-5 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-xs space-y-1">
            <span className="text-[11px] font-black text-[var(--text-secondary)]/60 block">
              {t('postTrip.activitiesLogged')}
            </span>
            <div className="text-2xl chart-heading font-bold text-[var(--text-primary)]">
              {t('postTrip.14Experiences')}
            </div>
            <span className="text-xs text-[var(--text-secondary)]/70 font-medium">
              {t('postTrip.divingDesertCafes')}
            </span>
          </div>

          <div className="p-5 rounded-3xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-xs space-y-1">
            <span className="text-[11px] font-black text-[var(--text-secondary)]/60 block">
              {t('postTrip.officialInvoice')}
            </span>
            <div className="text-2xl font-mono font-bold text-[var(--text-primary)]">14,500 EGP</div>
            <button
              type="button"
              onClick={() => showToast(t('postTrip.downloadingInvoicePDF'))}
              className="text-xs font-bold text-[var(--accent-secondary)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>{t('postTrip.downloadPDF')}</span>
            </button>
          </div>
        </div>

        {/* 2 Columns: Photos & Feedback */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (7/12): Memory Gallery & Places */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Visual Memories */}
            <div className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-8 border border-[var(--border-subtle)] shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[var(--accent-secondary)]" />
                  <h2 className="chart-heading font-bold text-xl text-[var(--text-primary)]">
                    {t('postTrip.visualHighlights')}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('/memories')}
                  className="text-xs font-bold text-[var(--accent-secondary)] hover:underline flex items-center gap-1"
                >
                  <span>{t('postTrip.passportBadges')}</span>
                  <ArrowRight className={`w-3 h-3 ${isRTL ? 'rotate-180' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {photoMemories.length === 0 && (
                  <div className="col-span-full p-6 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-center space-y-1">
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      {t('postTrip.noPhotosSavedYet')}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]/70">
                      {t('postTrip.photosYouSaveTo')}
                    </p>
                  </div>
                )}
                {photoMemories.map((photo, i) => {
                  const title = language === 'ar' ? photo.titleAr : photo.title;
                  const tag = language === 'ar' ? photo.tagAr : photo.tag;
                  return (
                    <div
                      key={i}
                      className="group relative h-48 rounded-2xl overflow-hidden bg-[var(--surface-container)] border border-[var(--border-subtle)] shadow-2xs"
                    >
                      <img
                        src={photo.image}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <span className="text-[11px] font-bold text-amber-300 block">
                          {tag}
                        </span>
                        <h3 className="font-bold text-sm text-white">
                          {title}
                        </h3>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Places Visited Checklist */}
            <div className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-8 border border-[var(--border-subtle)] shadow-xs space-y-4">
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <h2 className="chart-heading font-bold text-lg text-[var(--text-primary)]">
                  {t('postTrip.placesExploredInDahab')}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {placesVisited.length === 0 && (
                  <div className="col-span-full p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]/70">
                    {t('postTrip.thePlacesYouVisited')}
                  </div>
                )}
                {placesVisited.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)]"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{language === 'ar' ? p.ar : p.en}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column (5/12): Feedback & Next Trip */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Feedback Review Form */}
            <div className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xs space-y-5">
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <h2 className="chart-heading font-bold text-lg text-[var(--text-primary)]">
                  {t('postTrip.howWasYourDahab')}
                </h2>
                <p className="text-xs text-[var(--text-secondary)]/70">
                  {t('postTrip.yourFeedbackSupportsLocal')}
                </p>
              </div>

              {isFeedbackSubmitted ? (
                <div className="p-6 rounded-2xl bg-emerald-900/30 border border-emerald-500/40 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <h3 className="font-bold text-sm text-emerald-200">
                    {t('postTrip.feedbackSubmitted')}
                  </h3>
                  <p className="text-xs text-emerald-300/80">
                    {t('postTrip.200SinaiExplorerPoints')}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitFeedback} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-[var(--text-primary)] mb-1.5">
                      {t('postTrip.overallExperienceRating')}
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          aria-pressed={star <= rating}
                          aria-label={t('postTrip.rateOutOf5', { star })}
                          className="p-1 cursor-pointer transition-transform hover:scale-110"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              star <= rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-stone-600'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="posttrip-favorite-highlight" className="block font-bold text-[var(--text-primary)] mb-1">
                      {t('postTrip.favoriteHighlight')}
                    </label>
                    <input
                      id="posttrip-favorite-highlight"
                      type="text"
                      value={favoriteExperience}
                      onChange={(e) => setFavoriteExperience(e.target.value)}
                      className="w-full p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-secondary)] outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="posttrip-feedback-notes" className="block font-bold text-[var(--text-primary)] mb-1">
                      {t('postTrip.detailedNotesSuggestions')}
                    </label>
                    <textarea
                      id="posttrip-feedback-notes"
                      rows={3}
                      value={feedbackNotes}
                      onChange={(e) => setFeedbackNotes(e.target.value)}
                      className="w-full p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-secondary)] outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-full bg-[var(--accent-secondary)] hover:bg-amber-300 text-[var(--surface-card)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer shadow-xs"
                  >
                    {t('postTrip.submitReview')}
                  </button>
                </form>
              )}
            </div>

            {/* Dahab Passport & Badges Section */}
            <div id="dahab-digital-passport-card" className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <h2 className="chart-heading font-bold text-lg text-[var(--text-primary)]">
                    {t('postTrip.sinaiPassportStamps')}
                  </h2>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  4 {t('postTrip.stamps')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { nameEn: 'Blue Hole Certified', nameAr: 'ختم البلو هول', icon: 'dive', date: 'Oct 13', code: 'BH-01' },
                  { nameEn: 'Canyon Diver', nameAr: 'ختم الكانيون المرجاني', icon: 'reef', date: 'Oct 14', code: 'CY-02' },
                  { nameEn: 'Sinai Bedouin Stargazer', nameAr: 'سهرة وادي قني', icon: 'star', date: 'Oct 14', code: 'WG-03' },
                  { nameEn: 'Lighthouse Sunset Explorer', nameAr: 'لايتهاوس لاجون', icon: 'sunset', date: 'Oct 15', code: 'LH-04' },
                ].map((stamp, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-[var(--surface-container)] border-2 border-dashed border-[var(--accent-secondary)]/30 flex flex-col items-center text-center space-y-1 relative group hover:border-[var(--accent-secondary)] transition-colors">
                    <CategoryIcon kind={stamp.icon as CategoryKind} className="w-6 h-6" />
                    <span className="font-bold text-[12px] text-[var(--text-primary)] leading-tight">
                      {language === 'ar' ? stamp.nameAr : stamp.nameEn}
                    </span>
                    <div className="flex items-center justify-between w-full text-[11px] text-[var(--text-secondary)]/60 font-mono pt-1 border-t border-[var(--border-subtle)]">
                      <span>{stamp.code}</span>
                      <span>{stamp.date}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => showToast(t('postTrip.generatedHighresDigitalPassport'))}
                className="w-full py-2.5 rounded-full bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] text-[var(--text-primary)] text-xs font-bold border border-[var(--border-subtle)] transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('postTrip.downloadDigitalPassport')}</span>
              </button>
            </div>

            {/* Next Sinai Inspiration Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-[var(--surface-container)] to-[var(--surface-card)] text-white space-y-4 shadow-lg border border-[var(--border-subtle)]">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--btn-util-bg)] text-amber-300 text-[11px] font-bold">
                <Sparkles className="w-3 h-3" />
                <span>{t('postTrip.nextSinaiAdventure')}</span>
              </div>

              <h3 className="chart-heading font-bold text-lg text-[var(--text-primary)]">
                {t('postTrip.readyForRasAbu')}
              </h3>

              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {t('postTrip.basedOnYourLove')}
              </p>

              <button
                type="button"
                onClick={() => navigateTo('/trip-builder')}
                className="w-full py-2.5 rounded-full bg-[var(--accent-secondary)] hover:bg-amber-300 text-[var(--surface-card)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>{t('postTrip.startDesigningNextTrip')}</span>
                <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
              </button>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
};

import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Lock,
  Plus,
  Trash2,
  Sliders,
  Sparkles,
  Heart,
  Ban,
  Save
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTrip } from '../../context/TripContext';
import { TripConstraint } from '../../types/tripOs';

interface TripBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TripBriefModal: React.FC<TripBriefModalProps> = ({ isOpen, onClose }) => {
  const { language, isRTL , t} = useLanguage();
  const { tripBrief, updateTripBrief, showToast } = useTrip();

  const [travelerName, setTravelerName] = useState(tripBrief.travelerName);
  const [durationDays, setDurationDays] = useState(tripBrief.durationDays);
  const [travelersCount, setTravelersCount] = useState(tripBrief.travelersCount);
  const [budgetTier, setBudgetTier] = useState(tripBrief.budgetTier);
  const [estimatedBudgetEGP, setEstimatedBudgetEGP] = useState(tripBrief.estimatedBudgetEGP);
  const [pace, setPace] = useState(tripBrief.pace);
  const [comfortLevel, setComfortLevel] = useState(tripBrief.comfortLevel);

  const [mustHaves, setMustHaves] = useState<TripConstraint[]>(tripBrief.mustHaves);
  const [preferences, setPreferences] = useState<TripConstraint[]>(tripBrief.preferences);
  const [avoidances, setAvoidances] = useState<TripConstraint[]>(tripBrief.avoidances);

  const [newConstraintText, setNewConstraintText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'must_have' | 'prefer' | 'avoid'>('must_have');

  if (!isOpen) return null;

  const handleAddConstraint = () => {
    if (!newConstraintText.trim()) return;
    const newConstraint: TripConstraint = {
      id: `custom-c-${Date.now()}`,
      type: selectedCategory,
      category: 'comfort',
      label: newConstraintText.trim(),
      labelAr: newConstraintText.trim(),
      description: 'Custom traveler constraint added directly in Trip OS.',
      descriptionAr: 'شرط مخصص أضافه المسافر مباشرة في نظام الرحلة.',
    };

    if (selectedCategory === 'must_have') {
      setMustHaves((prev) => [...prev, newConstraint]);
    } else if (selectedCategory === 'prefer') {
      setPreferences((prev) => [...prev, newConstraint]);
    } else {
      setAvoidances((prev) => [...prev, newConstraint]);
    }
    setNewConstraintText('');
  };

  const handleRemoveConstraint = (id: string, type: 'must_have' | 'prefer' | 'avoid') => {
    if (type === 'must_have') {
      setMustHaves((prev) => prev.filter((c) => c.id !== id));
    } else if (type === 'prefer') {
      setPreferences((prev) => prev.filter((c) => c.id !== id));
    } else {
      setAvoidances((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleSaveAndApply = () => {
    updateTripBrief({
      travelerName,
      durationDays,
      travelersCount,
      budgetTier,
      estimatedBudgetEGP,
      pace,
      comfortLevel,
      mustHaves,
      preferences,
      avoidances,
    });
    showToast(
      t('tripos.tripBriefUpdatedAnd')
    );
    onClose();
  };

  return (
    <div
      id="modal-trip-brief-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      dir={isRTL ? 'rtl' : 'ltr'}
    
      role="dialog"
      aria-modal="true"
      aria-labelledby="trip-brief-modal-dialog-1-title"
    >
      <div
        id="modal-trip-brief-container"
        className="bg-[var(--surface-card)] rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-200 my-8 flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-6 bg-[var(--surface-card)] text-white flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-[12px] font-black text-amber-300">
                {t('tripos.tRIPOSBRIEFENGINE')}
              </span>
            </div>
            <h2 id="trip-brief-modal-dialog-1-title" className="text-xl sm:text-2xl font-extrabold">
              {t('tripos.refineTripConstraintsGoals')}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-2xl bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
          {/* Section 1: Basic Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {t('tripos.travelerName')}
              </label>
              <input
                type="text"
                value={travelerName}
                onChange={(e) => setTravelerName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[var(--brand-sand)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {t('tripos.durationDays')}
              </label>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[var(--brand-sand)]"
              >
                <option value={3}>3 Days (Weekend Escape)</option>
                <option value={4}>4 Days (Standard Dahab)</option>
                <option value={5}>5 Days (Recommended)</option>
                <option value={6}>6 Days (Deep Diving & Canyons)</option>
                <option value={7}>7 Days (Full Sinai Immersion)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {t('tripos.travelerCount')}
              </label>
              <select
                value={travelersCount}
                onChange={(e) => setTravelersCount(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[var(--brand-sand)]"
              >
                <option value={1}>1 Solo Traveler</option>
                <option value={2}>2 Couple / Friends</option>
                <option value={3}>3 Small Group</option>
                <option value={4}>4 Friends / Family</option>
              </select>
            </div>
          </div>

          {/* Section 2: Pace & Budget Tier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {t('tripos.paceIntensity')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Relaxed', 'Balanced', 'Active'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPace(p)}
                    className={`py-2 rounded-xl text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border ${
                      pace === p
                        ? 'bg-[var(--surface-card)] text-amber-300 border-[var(--surface-card)]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t(`profile.pace.${p}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                {t('tripos.budgetTier')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Budget', 'Moderate', 'Premium'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      setBudgetTier(b);
                      setEstimatedBudgetEGP(b === 'Budget' ? 9500 : b === 'Moderate' ? 16800 : 26000);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border ${
                      budgetTier === b
                        ? 'bg-[var(--brand-sand)] text-white border-[var(--brand-sand)]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t(`hotels.${b.toLowerCase()}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Add Custom Constraint */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-900">
                {t('tripos.addCustomTripConstraint')}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('must_have')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                    selectedCategory === 'must_have' ? 'bg-emerald-600 text-white' : 'bg-[var(--surface-card)] text-slate-600 border border-slate-200'
                  }`}
                >
                  Must-Have
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('prefer')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                    selectedCategory === 'prefer' ? 'bg-amber-500 text-white' : 'bg-[var(--surface-card)] text-slate-600 border border-slate-200'
                  }`}
                >
                  Preference
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('avoid')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                    selectedCategory === 'avoid' ? 'bg-rose-500 text-white' : 'bg-[var(--surface-card)] text-slate-600 border border-slate-200'
                  }`}
                >
                  Avoidance
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newConstraintText}
                onChange={(e) => setNewConstraintText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddConstraint()}
                aria-label={t('tripos.addConstraint')}
                placeholder={
                  t('tripos.egVegetarianMealsOnly')
                }
                className="flex-1 bg-[var(--surface-card)] border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[var(--brand-sand)]"
              />
              <button
                type="button"
                onClick={handleAddConstraint}
                className="px-4 py-2 rounded-xl bg-slate-950 text-white font-bold text-xs hover:bg-black transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('tripos.add')}</span>
              </button>
            </div>
          </div>

          {/* Section 4: Current Active Lists with Delete Controls */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-400">
              {t('tripos.currentActiveConstraints')}
            </h4>

            {/* Must Haves */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Must-Haves ({mustHaves.length})</span>
              </div>
              <div className="space-y-1.5">
                {mustHaves.map((mh) => (
                  <div
                    key={mh.id}
                    className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-emerald-950">
                      {language === 'ar' ? mh.labelAr : mh.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveConstraint(mh.id, 'must_have')}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Preferences */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-amber-600" />
                <span>Preferences ({preferences.length})</span>
              </div>
              <div className="space-y-1.5">
                {preferences.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-amber-950">
                      {language === 'ar' ? p.labelAr : p.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveConstraint(p.id, 'prefer')}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Avoidances */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5 text-rose-600" />
                <span>Avoidances ({avoidances.length})</span>
              </div>
              <div className="space-y-1.5">
                {avoidances.map((a) => (
                  <div
                    key={a.id}
                    className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200/80 flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-rose-950">
                      {language === 'ar' ? a.labelAr : a.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveConstraint(a.id, 'avoid')}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-[var(--surface-card)] hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 cursor-pointer transition-colors"
          >
            {t('tripos.cancel')}
          </button>

          <button
            type="button"
            onClick={handleSaveAndApply}
            className="px-6 py-2.5 rounded-2xl bg-[var(--surface-card)] hover:bg-black text-amber-300 font-extrabold text-xs shadow-lg cursor-pointer transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center gap-2"
          >
            <Save className="w-4 h-4 text-amber-400" />
            <span>{t('tripos.saveReAlignTripOS')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useUI } from '../../context/UIContext';
import { api } from '../../services/api';
import {
  PARTY_CATEGORIES,
  PARTY_ZONES,
  type PartyCategory,
  type PartyView,
  type PartyWritePayload,
  type PartyZone
} from '../../shared/dahabParties';

/**
 * Parties admin — catalogue curation for Operations.
 *
 * Deliberately compact: the licence toggle is the one control with teeth
 * (unverified rows never reach the public catalogue), featured is ordering,
 * delete is offboarding. The create form carries the required fields only —
 * rich copy editing belongs in the seed catalogue, not in a form.
 */

export const PartiesAdminPanel: React.FC = () => {
  const { language, t } = useLanguage();
  const { showToast } = useUI();
  const isAr = language === 'ar';

  const [parties, setParties] = useState<PartyView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    api.getAdminDahabParties()
      .then(res => setParties(res.parties))
      .catch(err => setError(err?.message || t('parties.admin.loadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { reload(); }, [reload]);

  const withToast = (promise: Promise<unknown>, okMessage: string) =>
    promise
      .then(() => showToast(okMessage))
      .catch(err => showToast(err?.message || t('parties.admin.actionFailed')))
      .finally(reload);

  const toggleVerified = (party: PartyView) =>
    withToast(api.setDahabPartyLicenseVerified(party.id, !party.licenseVerified), t('parties.admin.updated'));

  const toggleFeatured = (party: PartyView) =>
    withToast(api.updateDahabParty(party.id, { isFeatured: !party.isFeatured }), t('parties.admin.updated'));

  const remove = (party: PartyView) => {
    if (!window.confirm(t('parties.admin.confirmDelete', { name: isAr ? party.nameAr : party.nameEn }))) return;
    void withToast(api.deleteDahabParty(party.id), t('parties.admin.deleted'));
  };

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[#0a0f1e] text-slate-100 px-4 sm:px-8 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-extrabold">{t('parties.admin.title')}</h1>
            <p className="text-xs font-bold text-slate-400 mt-1">{t('parties.admin.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(s => !s)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-sm font-extrabold hover:bg-amber-300 cursor-pointer"
          >
            {showCreate ? <X className="w-4 h-4" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
            {showCreate ? t('parties.admin.closeForm') : t('parties.admin.addParty')}
          </button>
        </div>

        {showCreate && (
          <CreatePartyForm
            onCreated={() => {
              setShowCreate(false);
              reload();
            }}
          />
        )}

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
        {loading && parties.length === 0 ? (
          <p className="text-sm text-slate-400 py-12 text-center">{t('cmd.loading')}</p>
        ) : (
          <div className="space-y-3">
            {parties.map(party => (
              <div
                key={party.id}
                className={`rounded-2xl border p-4 flex flex-wrap items-center gap-3 ${
                  party.licenseVerified
                    ? 'border-white/10 bg-white/[0.04]'
                    : 'border-amber-400/40 bg-amber-400/[0.06]'
                }`}
              >
                <div className="flex-1 min-w-52">
                  <p className="text-sm font-extrabold">{isAr ? party.nameAr : party.nameEn}</p>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                    {party.id} · {t(`parties.category.${party.category}`)} · {party.startTime} · {party.priceEgp} EGP
                    {!party.licenseVerified && (
                      <span className="ms-2 inline-flex items-center gap-1 text-amber-300">
                        <ShieldAlert className="w-3 h-3" aria-hidden="true" />
                        {t('parties.admin.unverified')}
                      </span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleVerified(party)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                    party.licenseVerified
                      ? 'bg-teal-400/15 text-teal-300 hover:bg-teal-400/25'
                      : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  }`}
                  aria-pressed={party.licenseVerified}
                >
                  <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  {party.licenseVerified ? t('parties.admin.verified') : t('parties.admin.markVerified')}
                </button>

                <button
                  type="button"
                  onClick={() => toggleFeatured(party)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                    party.isFeatured ? 'bg-amber-400/15 text-amber-300' : 'bg-white/5 text-slate-400'
                  }`}
                  aria-pressed={party.isFeatured}
                >
                  {t('parties.admin.featured')}
                </button>

                <button
                  type="button"
                  onClick={() => remove(party)}
                  className="p-2 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/25 cursor-pointer"
                  aria-label={t('parties.admin.delete')}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CreatePartyForm: React.FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const { t } = useLanguage();
  const { showToast } = useUI();
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    nameEn: '',
    nameAr: '',
    venueName: '',
    category: 'beach_bar_live' as PartyCategory,
    zone: 'mamsha' as PartyZone,
    frequency: 'weekly' as 'daily' | 'weekly' | 'monthly' | 'one_time',
    startTime: '21:00',
    priceModel: 'free' as 'free' | 'ticket' | 'whatsapp' | 'donation',
    priceEgp: 0,
    meetingPointName: '',
    meetingPointLat: 28.4945,
    meetingPointLng: 34.513,
    bookingType: 'walkin' as 'walkin' | 'whatsapp' | 'local_ticket',
    whatsappNumber: '',
    durationHours: 4
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload: PartyWritePayload = {
      category: form.category,
      zone: form.zone,
      nameEn: form.nameEn,
      nameAr: form.nameAr,
      venueName: form.venueName,
      durationHours: Number(form.durationHours),
      frequency: form.frequency,
      days: form.frequency === 'weekly' ? ['Friday'] : [],
      startTime: form.startTime,
      priceModel: form.priceModel,
      priceEgp: Number(form.priceEgp),
      entryType: form.priceModel === 'free' ? 'free' : 'ticket_includes_drink',
      meetingPointName: form.meetingPointName,
      meetingPointLat: Number(form.meetingPointLat),
      meetingPointLng: Number(form.meetingPointLng),
      bookingType: form.bookingType,
      ...(form.bookingType === 'whatsapp' && form.whatsappNumber ? { whatsappNumber: form.whatsappNumber } : {}),
      // New rows land unverified on purpose: an admin form is not licence
      // paperwork. The public catalogue stays empty until Operations checks.
      licenseVerified: false
    };
    api.createDahabParty(payload)
      .then(() => {
        showToast(t('parties.admin.created'));
        onCreated();
      })
      .catch(err => showToast(err?.message || t('parties.admin.actionFailed')))
      .finally(() => setBusy(false));
  };

  const inputCls = 'w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm font-bold text-slate-100 [color-scheme:dark]';
  const labelCls = 'text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 block';

  return (
    <form onSubmit={submit} className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className={labelCls} htmlFor="np-name-en">{t('parties.admin.fNameEn')}</label>
        <input id="np-name-en" required maxLength={160} value={form.nameEn} onChange={set('nameEn')} className={inputCls} />
      </div>
      <div>
        <label className={labelCls} htmlFor="np-name-ar">{t('parties.admin.fNameAr')}</label>
        <input id="np-name-ar" required maxLength={160} value={form.nameAr} onChange={set('nameAr')} className={inputCls} />
      </div>
      <div>
        <label className={labelCls} htmlFor="np-venue">{t('parties.admin.fVenue')}</label>
        <input id="np-venue" required maxLength={160} value={form.venueName} onChange={set('venueName')} className={inputCls} />
      </div>
      <div>
        <label className={labelCls} htmlFor="np-meeting">{t('parties.admin.fMeeting')}</label>
        <input id="np-meeting" required maxLength={200} value={form.meetingPointName} onChange={set('meetingPointName')} className={inputCls} />
      </div>
      <div>
        <label className={labelCls} htmlFor="np-cat">{t('parties.admin.fCategory')}</label>
        <select id="np-cat" value={form.category} onChange={set('category')} className={inputCls}>
          {PARTY_CATEGORIES.map(c => <option key={c} value={c}>{t(`parties.category.${c}`)}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor="np-zone">{t('parties.admin.fZone')}</label>
        <select id="np-zone" value={form.zone} onChange={set('zone')} className={inputCls}>
          {PARTY_ZONES.map(z => <option key={z} value={z}>{t(`parties.zone.${z}`)}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor="np-freq">{t('parties.admin.fFrequency')}</label>
        <select id="np-freq" value={form.frequency} onChange={set('frequency')} className={inputCls}>
          {(['daily', 'weekly', 'monthly', 'one_time'] as const).map(f => (
            <option key={f} value={f}>{t(`parties.frequency.${f}`)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor="np-start">{t('parties.admin.fStart')}</label>
        <input id="np-start" required pattern="\d{2}:\d{2}" value={form.startTime} onChange={set('startTime')} className={inputCls} />
      </div>
      <div>
        <label className={labelCls} htmlFor="np-price-model">{t('parties.admin.fPriceModel')}</label>
        <select id="np-price-model" value={form.priceModel} onChange={set('priceModel')} className={inputCls}>
          {(['free', 'ticket', 'whatsapp', 'donation'] as const).map(m => (
            <option key={m} value={m}>{t(`parties.priceModel.${m}`)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor="np-price">{t('parties.admin.fPriceEgp')}</label>
        <input id="np-price" type="number" min={0} value={form.priceEgp} onChange={set('priceEgp')} className={inputCls} />
      </div>
      <div>
        <label className={labelCls} htmlFor="np-booking">{t('parties.admin.fBooking')}</label>
        <select id="np-booking" value={form.bookingType} onChange={set('bookingType')} className={inputCls}>
          {(['walkin', 'whatsapp', 'local_ticket'] as const).map(b => (
            <option key={b} value={b}>{t(`parties.bookingType.${b}`)}</option>
          ))}
        </select>
      </div>
      {form.bookingType === 'whatsapp' && (
        <div>
          <label className={labelCls} htmlFor="np-wa">{t('parties.admin.fWhatsapp')}</label>
          <input id="np-wa" required placeholder="+2010…" maxLength={32} value={form.whatsappNumber} onChange={set('whatsappNumber')} className={inputCls} />
        </div>
      )}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 text-sm font-extrabold hover:bg-amber-300 disabled:opacity-60 cursor-pointer"
        >
          {busy ? t('parties.admin.saving') : t('parties.admin.create')}
        </button>
      </div>
    </form>
  );
};

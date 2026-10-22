import React, { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';

type Zone = Record<string, string | number | boolean>;
type Bus = Record<string, string | number | boolean>;
type Driver = Record<string, string | number | boolean | string[]>;

const inputClass = 'mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold text-[var(--text-muted)]">
      {label}
      {children}
    </label>
  );
}

/**
 * Operations editor for the future-ride matrix, the seeded bus timetable,
 * and the verified driver roster. Supplier cost stays on this screen.
 */
export default function TransferHubAdmin({ pane }: { pane: 'matrix' | 'timetable' | 'drivers' }) {
  const { t } = useLanguage();
  const [zones, setZones] = useState<Zone[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [saved, setSaved] = useState<string | null>(null);

  const load = () => {
    api.getOpsTransferCatalog().then(data => {
      setZones(data.zones || []);
      setBuses(data.buses || []);
      setDrivers(data.drivers || []);
    }).catch(() => undefined);
  };

  useEffect(() => { load(); }, []);

  const markSaved = (id: string) => {
    setSaved(id);
    load();
  };

  if (pane === 'matrix') {
    return (
      <div className="space-y-3">
        {zones.map(zone => (
          <form key={`${zone.id}-${zone.privateEGP}-${zone.supplierPrivateEGP}-${zone.busEGP}-${zone.supplierBusEGP}-${zone.lastMileEGP}-${zone.lastMileDriverDiscountEGP}`} className="rounded-xl border border-[var(--border-subtle)] p-3 space-y-3" onSubmit={event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const num = (name: string) => Number(form.get(name));
            api.updateOpsTransferZone(String(zone.id), {
              privateEGP: num('privateEGP'),
              supplierPrivateEGP: num('supplierPrivateEGP'),
              busEGP: num('busEGP'),
              supplierBusEGP: num('supplierBusEGP'),
              lastMileEGP: num('lastMileEGP'),
              lastMileDriverDiscountEGP: num('lastMileDriverDiscountEGP')
            }).then(() => markSaved(String(zone.id)));
          }}>
            <div className="font-bold">{String(zone.labelEn)} · {String(zone.haul)}</div>
            {zone.haul === 'short' && <p className="text-[11px] text-[var(--text-muted)]">{t('cmd.transfers.shortHaulNote')}</p>}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label={t('cmd.transfers.field.private')}>
                <input name="privateEGP" type="number" min={0} dir="ltr" defaultValue={Number(zone.privateEGP)} className={inputClass} />
              </Field>
              <Field label={t('cmd.transfers.field.supplierPrivate')}>
                <input name="supplierPrivateEGP" type="number" min={0} dir="ltr" defaultValue={Number(zone.supplierPrivateEGP)} className={inputClass} />
              </Field>
              <Field label={t('cmd.transfers.field.bus')}>
                <input name="busEGP" type="number" min={0} dir="ltr" defaultValue={Number(zone.busEGP)} className={inputClass} />
              </Field>
              <Field label={t('cmd.transfers.field.supplierBus')}>
                <input name="supplierBusEGP" type="number" min={0} dir="ltr" defaultValue={Number(zone.supplierBusEGP)} className={inputClass} />
              </Field>
              <Field label={t('cmd.transfers.field.lastMile')}>
                <input name="lastMileEGP" type="number" min={0} dir="ltr" defaultValue={Number(zone.lastMileEGP)} className={inputClass} />
              </Field>
              <Field label={t('cmd.transfers.field.subsidy')}>
                <input name="lastMileDriverDiscountEGP" type="number" min={0} dir="ltr" defaultValue={Number(zone.lastMileDriverDiscountEGP)} className={inputClass} />
              </Field>
            </div>
            <button type="submit" className="rounded-lg bg-[var(--accent-primary)] text-white text-sm font-bold px-4 py-2">
              {saved === String(zone.id) ? t('cmd.transfers.saved') : t('cmd.transfers.save')}
            </button>
          </form>
        ))}
      </div>
    );
  }

  if (pane === 'timetable') {
    return (
      <div className="space-y-3">
        <button type="button" className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm font-bold" onClick={() => api.addOpsTransferBus('cairo').then(load)}>{t('cmd.transfers.addBus')}</button>
        {buses.map(bus => (
          <form key={`${bus.id}-${bus.departLabel}-${bus.arriveLabel}-${bus.priceEGP}-${bus.seats}`} className="rounded-xl border border-[var(--border-subtle)] p-3 space-y-3" onSubmit={event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            api.updateOpsTransferBus(String(bus.id), {
              departLabel: String(form.get('departLabel') || ''),
              arriveLabel: String(form.get('arriveLabel') || ''),
              priceEGP: Number(form.get('priceEGP')),
              seats: Number(form.get('seats'))
            }).then(() => markSaved(String(bus.id)));
          }}>
            <div className="font-bold">{String(bus.operatorName)} · {String(bus.originId)}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label={t('cmd.transfers.field.depart')}>
                <input name="departLabel" defaultValue={String(bus.departLabel)} className={inputClass} />
              </Field>
              <Field label={t('cmd.transfers.field.arrive')}>
                <input name="arriveLabel" defaultValue={String(bus.arriveLabel || '')} className={inputClass} />
              </Field>
              <Field label={t('cmd.transfers.field.price')}>
                <input name="priceEGP" type="number" min={0} dir="ltr" defaultValue={Number(bus.priceEGP)} className={inputClass} />
              </Field>
              <Field label={t('cmd.transfers.field.seats')}>
                <input name="seats" type="number" min={0} dir="ltr" defaultValue={Number(bus.seats)} className={inputClass} />
              </Field>
            </div>
            <button type="submit" className="rounded-lg bg-[var(--accent-primary)] text-white text-sm font-bold px-4 py-2">
              {saved === String(bus.id) ? t('cmd.transfers.saved') : t('cmd.transfers.save')}
            </button>
          </form>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {drivers.map(driver => (
        <form key={`${driver.id}-${driver.nameEn}-${driver.phone}-${driver.plate}-${driver.rating}-${driver.active}`} className="rounded-xl border border-[var(--border-subtle)] p-3 space-y-3" onSubmit={event => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          api.updateOpsTransferDriver(String(driver.id), {
            nameEn: String(form.get('nameEn') || ''),
            nameAr: String(form.get('nameAr') || ''),
            phone: String(form.get('phone') || ''),
            plate: String(form.get('plate') || ''),
            rating: Number(form.get('rating')),
            active: form.get('active') === 'on'
          }).then(() => markSaved(String(driver.id)));
        }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label={t('cmd.transfers.field.name')}>
              <input name="nameEn" defaultValue={String(driver.nameEn)} className={inputClass} />
            </Field>
            <Field label={t('cmd.transfers.field.nameAr')}>
              <input name="nameAr" defaultValue={String(driver.nameAr || '')} className={inputClass} />
            </Field>
            <Field label={t('cmd.transfers.field.phone')}>
              <input name="phone" dir="ltr" defaultValue={String(driver.phone || '')} className={inputClass} />
            </Field>
            <Field label={t('cmd.transfers.field.plate')}>
              <input name="plate" defaultValue={String(driver.plate || '')} className={inputClass} />
            </Field>
            <Field label={t('cmd.transfers.field.rating')}>
              <input name="rating" type="number" min={0} max={5} step={0.01} dir="ltr" defaultValue={Number(driver.rating)} className={inputClass} />
            </Field>
            <label className="flex items-end gap-2 text-sm font-bold pb-2">
              <input name="active" type="checkbox" defaultChecked={driver.active !== false} />
              {t('cmd.transfers.field.active')}
            </label>
          </div>
          <button type="submit" className="rounded-lg bg-[var(--accent-primary)] text-white text-sm font-bold px-4 py-2">
            {saved === String(driver.id) ? t('cmd.transfers.saved') : t('cmd.transfers.save')}
          </button>
        </form>
      ))}
    </div>
  );
}

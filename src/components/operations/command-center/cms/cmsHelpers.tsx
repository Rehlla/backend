import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

export function dotGet(obj: any, path: string): any {
  return path.split('.').reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export function dotSet(obj: any, path: string, value: any): any {
  const keys = path.split('.');
  const next = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  let node: any = next;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const child = node[k];
    node[k] = Array.isArray(child) ? [...child] : { ...(child != null && typeof child === 'object' ? child : {}) };
    node = node[k];
  }
  node[keys[keys.length - 1]] = value;
  return next;
}

export const CFG_INPUT_CLS = 'w-full px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none';
export const CFG_SELECT_CLS = 'w-full px-2 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none';

export const STAT_ACCENTS = [
  { value: 'text-[var(--accent-primary)]', label: 'Teal' },
  { value: 'text-cyan-400', label: 'Cyan' },
  { value: 'text-[var(--accent-secondary)]', label: 'Amber' },
  { value: 'text-rose-400', label: 'Rose' },
];

export const STAT_ICONS = ['anchor', 'eye', 'mountain', 'heart'];

/** Bilingual { en, ar } object field. */
export function BiObjField({ label, path, cfg, set }: {
  label: string;
  path: string;
  cfg: Record<string, any>;
  set: (path: string, value: any) => void;
}) {
  const node = dotGet(cfg, path) || {};
  return (
    <div>
      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">{label}</span>
      <div className="grid grid-cols-2 gap-2 mt-0.5">
        <input type="text" placeholder="EN" value={node.en || ''} onChange={e => set(`${path}.en`, e.target.value)} className={CFG_INPUT_CLS} />
        <input type="text" placeholder="AR" dir="rtl" value={node.ar || ''} onChange={e => set(`${path}.ar`, e.target.value)} className={CFG_INPUT_CLS} />
      </div>
    </div>
  );
}

/** Flat `key_en` / `key_ar` field (hero + marquee configs). */
export function BiFlatField({ label, keyName, cfg, set }: {
  label: string;
  keyName: string;
  cfg: Record<string, any>;
  set: (path: string, value: any) => void;
}) {
  return (
    <div>
      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">{label}</span>
      <div className="grid grid-cols-2 gap-2 mt-0.5">
        <input type="text" placeholder="EN" value={cfg[`${keyName}_en`] || ''} onChange={e => set(`${keyName}_en`, e.target.value)} className={CFG_INPUT_CLS} />
        <input type="text" placeholder="AR" dir="rtl" value={cfg[`${keyName}_ar`] || ''} onChange={e => set(`${keyName}_ar`, e.target.value)} className={CFG_INPUT_CLS} />
      </div>
    </div>
  );
}

export function SectionConfigEditor({ sectionKey, config, onChange }: {
  sectionKey: string;
  config: Record<string, any>;
  onChange: (cfg: Record<string, any>) => void;
}) {
  const cfg = config || {};
  const set = (path: string, value: any) => onChange(dotSet(cfg, path, value));

  if (sectionKey === 'hero') {
    const fields: [string, string][] = [
      ['badge', 'Badge'],
      ['subtitle', 'Subtitle'],
      ['cta_itinerary', 'Primary CTA label'],
      ['cta_whatnow', 'Secondary CTA label'],
      ['cta_explore', 'Tertiary CTA label'],
    ];
    const overlay = typeof cfg.overlay_opacity === 'number' ? cfg.overlay_opacity : 100;
    return (
      <div className="space-y-2.5">
        {fields.map(([k, label]) => (
          <BiFlatField key={k} label={label} keyName={k} cfg={cfg} set={set} />
        ))}
        <div>
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">
            Background scrim strength ({overlay}%)
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={overlay}
            onChange={e => set('overlay_opacity', Number(e.target.value))}
            className="w-full mt-1 accent-[var(--accent-primary)] cursor-pointer"
          />
        </div>
      </div>
    );
  }

  if (sectionKey === 'marquee') {
    return (
      <div className="space-y-2.5">
        <div>
          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Marquee items (separate with —)</span>
          <div className="grid grid-cols-2 gap-2 mt-0.5">
            <textarea rows={3} placeholder="EN items" value={cfg.items_en || ''} onChange={e => set('items_en', e.target.value)} className={`${CFG_INPUT_CLS} resize-y`} />
            <textarea rows={3} placeholder="AR items" dir="rtl" value={cfg.items_ar || ''} onChange={e => set('items_ar', e.target.value)} className={`${CFG_INPUT_CLS} resize-y`} />
          </div>
        </div>
      </div>
    );
  }

  if (sectionKey === 'final_cta') {
    const fields: [string, string][] = [
      ['badge', 'Badge'],
      ['headline', 'Headline'],
      ['headlineAccent', 'Headline accent'],
      ['supporting', 'Supporting text'],
      ['ctaPrimary', 'Primary CTA'],
      ['ctaSecondary', 'Secondary CTA'],
      ['footnote', 'Footnote'],
    ];
    return (
      <div className="space-y-2.5">
        {fields.map(([p, label]) => (
          <BiObjField key={p} label={label} path={p} cfg={cfg} set={set} />
        ))}
      </div>
    );
  }

  if (sectionKey === 'essence') {
    const tileFields: Record<string, [string, string][]> = {
      dive: [['kicker', 'Kicker'], ['title', 'Title'], ['line', 'Line'], ['desc', 'Description']],
      food: [['title', 'Title'], ['line', 'Line']],
      explore: [['title', 'Title'], ['line', 'Line']],
      stay: [['title', 'Title'], ['line', 'Line'], ['cta', 'CTA']],
      help: [['kicker', 'Kicker'], ['title', 'Title'], ['line', 'Line'], ['cta', 'CTA']],
    };
    const tileLabels: Record<string, string> = { dive: 'Dive tile', food: 'Food tile', explore: 'Explore tile', stay: 'Stay tile', help: 'Help tile' };
    return (
      <div className="space-y-2.5">
        <BiObjField label="Eyebrow" path="eyebrow" cfg={cfg} set={set} />
        <BiObjField label="Title" path="title" cfg={cfg} set={set} />
        <BiObjField label="Subtitle" path="subtitle" cfg={cfg} set={set} />
        {Object.keys(tileFields).map(tile => (
          <div key={tile} className="rounded-lg border border-[var(--border-subtle)] p-2.5 space-y-2">
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">{tileLabels[tile]}</span>
            {tileFields[tile].map(([p, label]) => (
              <BiObjField key={p} label={label} path={`${tile}.${p}`} cfg={cfg} set={set} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (sectionKey === 'stats') {
    const items: any[] = Array.isArray(cfg.items) ? cfg.items : [];
    const setItem = (i: number, patch: Record<string, any>) => {
      const next = items.map((it, j) => (j === i ? { ...it, ...patch } : it));
      set('items', next);
    };
    return (
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={item.id || `row-${i}`} className="rounded-lg border border-[var(--border-subtle)] p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">{item.id || `Stat ${i + 1}`}</span>
              <button
                type="button"
                onClick={() => set('items', items.filter((_, j) => j !== i))}
                className="p-1 rounded hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-rose-400 cursor-pointer"
                aria-label={`Remove stat ${i + 1}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Value (e.g. 100)" value={item.value || ''} onChange={e => setItem(i, { value: e.target.value })} className={CFG_INPUT_CLS} />
              <input type="text" placeholder="Suffix (e.g. m+)" value={item.suffix || ''} onChange={e => setItem(i, { suffix: e.target.value })} className={CFG_INPUT_CLS} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Label EN" value={item.label_en || ''} onChange={e => setItem(i, { label_en: e.target.value })} className={CFG_INPUT_CLS} />
              <input type="text" placeholder="Label AR" dir="rtl" value={item.label_ar || ''} onChange={e => setItem(i, { label_ar: e.target.value })} className={CFG_INPUT_CLS} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={item.accent || 'text-[var(--accent-primary)]'} onChange={e => setItem(i, { accent: e.target.value })} className={CFG_SELECT_CLS}>
                {STAT_ACCENTS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <select value={item.icon || 'anchor'} onChange={e => setItem(i, { icon: e.target.value })} className={CFG_SELECT_CLS}>
                {STAT_ICONS.map(ic => <option key={ic} value={ic}>{ic[0].toUpperCase() + ic.slice(1)}</option>)}
              </select>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => set('items', [...items, { id: `stat-${Date.now().toString(36)}`, value: '', suffix: '', label_en: '', label_ar: '', accent: 'text-[var(--accent-primary)]', icon: 'anchor' }])}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-xs font-bold hover:text-white cursor-pointer"
        >
          <Plus className="w-3 h-3" /> Add stat
        </button>
      </div>
    );
  }

  // Visibility-only sections (ticker, season, trip_entry, stories, micro,
  // landmarks, gallery, footer) — content is live or compiled.
  return (
    <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
      Content for this section is live data or compiled — use the eye toggle to show or hide it.
    </div>
  );
}

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SqlitePersistenceAdapter } from '../../server/db/sqlite/SqlitePersistenceAdapter';
import { initializeCmsSchema } from '../../server/db/sqlite/cmsSchema';
import { backfillHomepageSections, seedCmsContent } from '../../server/db/sqlite/cmsSeed';
import { cmsHomepage } from '../../server/services/contentService';
import { db } from '../../server/db/database';
import { InMemoryPersistenceAdapter } from '../../server/db/adapters/InMemoryPersistenceAdapter';
import {
  HERO_VEIL_DEFAULT,
  HOME_SECTIONS,
  HOME_SECTION_IDS
} from '../../src/shared/homeSections';
import { resolveHeroContent, resolveHomeLayout } from '../../src/components/home/concierge/homeLayout';
import { TRANSLATIONS } from '../../src/i18n/translations';

/**
 * The homepage's section contract.
 *
 * The bug this file exists for: the CMS seeded thirteen section keys for a
 * page that renders none of them, so the dashboard was fully editable and
 * fully inert — it edited a homepage that no longer existed. Three lists must
 * agree from now on (the seed, the page, the panel), and only the seed and the
 * page can be checked by reading them, so both are checked against the shipped
 * list AND against a real seeded database.
 */

const SRC = path.join(process.cwd(), 'src');
const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), 'utf8');

/** Every .tsx/.ts under src/components, as [path, source]. */
function componentSources(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push([path.relative(process.cwd(), full), fs.readFileSync(full, 'utf8')]);
    }
  };
  walk(path.join(SRC, 'components'));
  return out;
}

/** Keys the pre-rebuild homepage used, which must not come back. */
const LEGACY_KEYS = ['stats', 'marquee', 'essence', 'ticker', 'season', 'micro', 'landmarks', 'gallery', 'trip_entry'];

// ---------------------------------------------------------------------------
// The shipped list
// ---------------------------------------------------------------------------

describe('homepage section list', () => {
  it('is a unique, ordered, non-empty list', () => {
    expect(HOME_SECTIONS.length).toBeGreaterThan(0);
    expect(new Set(HOME_SECTION_IDS).size).toBe(HOME_SECTION_IDS.length);
    for (const spec of HOME_SECTIONS) {
      expect(spec.anchor.length, `${spec.id} has no anchor`).toBeGreaterThan(0);
    }
  });

  it('names each section in the catalog in both languages', () => {
    for (const spec of HOME_SECTIONS) {
      const entry = TRANSLATIONS[`cms.homeSections.${spec.id}.label`];
      expect(entry, `missing label for ${spec.id}`).toBeDefined();
      expect(entry.en.trim()).not.toBe('');
      expect(entry.ar.trim()).not.toBe('');
    }
  });

  it('has a rendered anchor in the component tree for every section', () => {
    const sources = componentSources();
    for (const spec of HOME_SECTIONS) {
      // '#id' → the id attribute; 'tag[attr="v"]' → the attribute as written in JSX.
      const needle = spec.anchor.startsWith('#')
        ? `id="${spec.anchor.slice(1)}"`
        : spec.anchor.replace(/^[^[]*\[/, '').replace(/\]$/, '');
      const found = sources.filter(([, source]) => source.includes(needle)).map(([file]) => file);
      expect(found.length, `nothing renders ${spec.id} (${spec.anchor})`).toBeGreaterThan(0);
    }
  });

  it('is composed by ConciergeHome — every id appears in its render map', () => {
    const home = read('src', 'components', 'home', 'concierge', 'ConciergeHome.tsx');
    for (const spec of HOME_SECTIONS) {
      expect(home.includes(`${spec.id}: `), `ConciergeHome does not render ${spec.id}`).toBe(true);
    }
  });

  /**
   * The reverse direction: a section the page DRAWS but the list never declares.
   *
   * `Record<HomeSectionId, …>` makes this a compile error inside ConciergeHome
   * and HomepageEditor, but a type check only fires for callers that run it —
   * and a section added to the render map by a caller that is not type-checked
   * (a cast, a dynamic key) would silently render with no CMS key behind it.
   * Reading the map back is what makes the seed and the page provably the same
   * set rather than merely both subsets of the same type.
   */
  it('reads back the render map — the page draws nothing the list does not declare', () => {
    const home = read('src', 'components', 'home', 'concierge', 'ConciergeHome.tsx');
    const start = home.indexOf('const sections');
    expect(start, 'ConciergeHome has no render map').toBeGreaterThan(-1);
    // Slice the record literal by brace depth rather than stopping at the first
    // "<div". Any section that renders a fragment containing a div (the hero
    // does) used to truncate the scan and hide every key after it, so the guard
    // silently passed on an incomplete read.
    const open = home.indexOf('{', start);
    let depth = 0;
    let end = open;
    for (let i = open; i < home.length; i++) {
      const ch = home[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const body = home.slice(start, end);
    const rendered = [...body.matchAll(/^\s{4}([a-z_]+):/gm)].map(m => m[1]);
    expect(rendered.length, 'could not read the ConciergeHome render map').toBeGreaterThan(0);
    expect([...rendered].sort()).toEqual([...HOME_SECTION_IDS].sort());
  });

  it('is the panel\'s list too — no private list, no legacy keys', () => {
    const editor = read('src', 'components', 'admin', 'HomepageEditor.tsx');
    expect(editor.includes('HOME_SECTIONS')).toBe(true);
    expect(editor.includes('specOf')).toBe(true);
    for (const key of LEGACY_KEYS) {
      expect(editor.includes(`'${key}'`), `panel still names the dead section ${key}`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// The seed, against a real database
// ---------------------------------------------------------------------------

describe('CMS homepage seed', () => {
  let dir: string;
  let adapter: SqlitePersistenceAdapter;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-homesec-'));
    adapter = new SqlitePersistenceAdapter(path.join(dir, 'test.sqlite'));
    db.setAdapter(adapter);
    initializeCmsSchema();
  });

  afterEach(() => {
    adapter.close();
    db.setAdapter(new InMemoryPersistenceAdapter());
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('seeds exactly the sections the page renders, in shipped order', () => {
    seedCmsContent();

    const rows = cmsHomepage.findAll();
    expect(rows.map(r => r.section_key)).toEqual([...HOME_SECTION_IDS]);
    for (const [index, row] of rows.entries()) {
      expect(row.visible).toBe(1);
      expect(row.sort_order).toBe(index);
    }

    // The hero row carries real defaults, not placeholders.
    const hero = rows.find(r => r.section_key === 'hero')!;
    expect(hero.title_en.trim()).not.toBe('');
    expect(hero.config.image_url).toBe('/images/hero/coral-reef-split.jpg');
    expect(hero.config.overlay_opacity).toBe(HERO_VEIL_DEFAULT);
    expect(hero.config.description_en.trim()).not.toBe('');
  });

  it('never leaves a key for a section nobody draws', () => {
    seedCmsContent();
    const keys = cmsHomepage.findAll().map(r => r.section_key);
    for (const legacy of LEGACY_KEYS) {
      expect(keys.includes(legacy), `seeded dead section ${legacy}`).toBe(false);
    }
  });

  it('reconciles an existing database: adds what is missing, retires what is gone', () => {
    const connection = (adapter as any).connection;
    connection
      .prepare(
        `INSERT INTO cms_homepage_sections (id, section_key, title_en, title_ar, visible, sort_order, config, updated_at)
         VALUES ('HSEC-OLD', 'marquee', 'Destination marquee', 'شريط الوجهات', 1, 0, '{}', '2026-01-01T00:00:00.000Z')`
      )
      .run();

    backfillHomepageSections();

    const byKey = new Map(cmsHomepage.findAll().map(r => [r.section_key, r]));
    for (const id of HOME_SECTION_IDS) {
      expect(byKey.has(id), `backfill missed ${id}`).toBe(true);
    }
    // The operator's row survives; it is hidden, not deleted.
    expect(byKey.get('marquee')?.visible).toBe(0);
    expect(byKey.get('marquee')?.title_en).toBe('Destination marquee');

    // Second run changes nothing.
    const before = JSON.stringify(cmsHomepage.findAll());
    backfillHomepageSections();
    expect(JSON.stringify(cmsHomepage.findAll())).toBe(before);
  });

  it('refreshes hero copy that still holds an old shipped default, never an edited one', () => {
    const connection = (adapter as any).connection;
    const insertHero = (titleAr: string, descriptionAr: string) =>
      connection
        .prepare(
          `INSERT INTO cms_homepage_sections (id, section_key, title_en, title_ar, visible, sort_order, config, updated_at)
           VALUES ('HSEC-HERO', 'hero', 'Where the desert', ?, 1, 0, ?, '2026-01-01T00:00:00.000Z')`
        )
        .run(titleAr, JSON.stringify({ description_ar: descriptionAr }));

    insertHero('حيث يلتقي', 'كل اللي تحتاجه في دهب — إقامة وأكل ومواصلات وشعاب وصحراء — في مكان واحد وهادي.');
    backfillHomepageSections();
    let hero = cmsHomepage.findAll().find(r => r.section_key === 'hero')!;
    expect(hero.title_ar).toBe('هنا الصحرا');
    expect(hero.config.description_ar).not.toContain('مواصلات');

    connection.prepare("DELETE FROM cms_homepage_sections WHERE section_key = 'hero'").run();
    insertHero('عنوان كتبه فريق التشغيل', 'وصف مخصص');
    backfillHomepageSections();
    hero = cmsHomepage.findAll().find(r => r.section_key === 'hero')!;
    expect(hero.title_ar).toBe('عنوان كتبه فريق التشغيل');
    expect(hero.config.description_ar).toBe('وصف مخصص');
  });
});

// ---------------------------------------------------------------------------
// visible / sort_order
// ---------------------------------------------------------------------------

describe('resolveHomeLayout', () => {
  const row = (section_key: string, sort_order: number, visible = 1) => ({ section_key, sort_order, visible });

  it('renders the shipped order when the CMS says nothing', () => {
    expect(resolveHomeLayout([])).toEqual([...HOME_SECTION_IDS]);
    expect(resolveHomeLayout(null)).toEqual([...HOME_SECTION_IDS]);
  });

  it('drops hidden sections and ignores unknown keys', () => {
    const layout = resolveHomeLayout([row('services', 99, 0), row('not_a_section', 0)]);
    expect(layout.includes('services')).toBe(false);
    expect(layout.length).toBe(HOME_SECTION_IDS.length - 1);
  });

  it('applies sort_order to the content sections', () => {
    const layout = resolveHomeLayout([row('stories', 0), row('services', 100)]);
    const content = layout.filter(id => !['hero', 'final_cta', 'footer'].includes(id));
    expect(content[0]).toBe('stories');
    expect(content[content.length - 1]).toBe('services');
  });

  it('keeps unlisted sections in their shipped slot', () => {
    // Only `stories` moves to the front of the content; the rest stay put.
    const layout = resolveHomeLayout([row('stories', -1)]);
    expect(layout[0]).toBe('hero');
    expect(layout[1]).toBe('stories');
    expect(layout.slice(2)).toEqual(HOME_SECTION_IDS.filter(id => id !== 'hero' && id !== 'stories'));
  });

  it('pins the page frame: hero first, closing CTA then footer last', () => {
    // The live rows that put the footer mid-page and the gallery below it.
    const layout = resolveHomeLayout([
      row('hero', 0), row('services', 2), row('final_cta', 3), row('experiences', 3),
      row('intent', 4), row('footer', 5), row('itineraries', 5), row('stories', 11)
    ]);
    expect(layout[0]).toBe('hero');
    expect(layout.slice(-2)).toEqual(['final_cta', 'footer']);
    expect(layout.indexOf('stories')).toBeLessThan(layout.indexOf('final_cta'));
  });

  it('still lets the CMS hide the frame sections', () => {
    const layout = resolveHomeLayout([row('final_cta', 0, 0)]);
    expect(layout.includes('final_cta')).toBe(false);
    expect(layout[layout.length - 1]).toBe('footer');
  });
});

describe('resolveHeroContent', () => {
  it('returns nothing to override when the CMS has no hero', () => {
    expect(resolveHeroContent(null, 'en')).toEqual({});
  });

  it('reads the row in the active language and leaves blanks absent', () => {
    const hero = {
      title_en: 'Where the desert',
      title_ar: 'حيث يلتقي',
      config: {
        image_url: '/images/hero/custom.jpg',
        description_en: 'English subtitle',
        description_ar: 'وصف عربي',
        overlay_opacity: 60
      }
    };

    expect(resolveHeroContent(hero, 'en')).toEqual({
      imageUrl: '/images/hero/custom.jpg',
      titleA: 'Where the desert',
      subtitle: 'English subtitle',
      veil: 60
    });
    expect(resolveHeroContent(hero, 'ar').titleA).toBe('حيث يلتقي');
    expect(resolveHeroContent(hero, 'ar').subtitle).toBe('وصف عربي');

    const blank = resolveHeroContent({ title_en: '  ', title_ar: '', config: {} }, 'en');
    expect(blank).toEqual({});
  });

  it('clamps the scrim to a usable percentage', () => {
    const veil = (n: unknown) =>
      resolveHeroContent({ title_en: 'x', title_ar: 'x', config: { overlay_opacity: n } }, 'en').veil;
    expect(veil(140)).toBe(100);
    expect(veil(-5)).toBe(0);
    expect(veil('70')).toBe(70);
    expect(veil('abc')).toBeUndefined();
  });
});

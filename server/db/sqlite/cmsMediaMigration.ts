import type { Database as SqliteDb } from 'better-sqlite3';
import { SqlitePersistenceAdapter } from './SqlitePersistenceAdapter';
import { db } from '../database';
import { ALLOWED_IMAGE_MIME_TYPES } from '../../utils/imageValidation';

/**
 * Migrate existing hardcoded Unsplash URLs to CMS media assets.
 *
 * This scans the known editorial content for Unsplash URLs and registers
 * them as cms_media entries with metadata. Runs once on first boot after
 * the CMS is initialized.
 */

function getConn(): SqliteDb | null {
  const adapter = db.getAdapter();
  if (adapter instanceof SqlitePersistenceAdapter) return adapter.connection;
  return null;
}

function now(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

interface MediaEntry {
  url: string;
  filename: string;
  alt_en: string;
  alt_ar: string;
  category: string;
  credit: string;
}

/**
 * Known Unsplash images used across the project.
 * Extracted from: dahabContent.ts, editorialContent.ts, readyTripsData.ts,
 * DahabGallerySection.tsx, CinematicVideoHero.tsx
 */
const KNOWN_MEDIA: MediaEntry[] = [
  // Gallery photos (from editorialContent.ts + DahabGallerySection.tsx)
  {
    url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=1600&auto=format&fit=crop',
    filename: 'blue-hole-bells.jpg',
    alt_en: 'The Blue Hole submarine sinkhole with coral walls',
    alt_ar: 'الحفرة الزرقاء مع جدران المرجان',
    category: 'diving',
    credit: 'Red Sea Marine Explorer',
  },
  {
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1600&auto=format&fit=crop',
    filename: 'blue-lagoon.jpg',
    alt_en: 'Blue Lagoon turquoise water with sandbars',
    alt_ar: 'مياه البلو لاجون الفيروزية مع الأرمال',
    category: 'lagoon',
    credit: 'Sinai Nomad Travel',
  },
  {
    url: 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?q=80&w=1600&auto=format&fit=crop',
    filename: 'canyon-rift.jpg',
    alt_en: 'Underwater canyon with sun rays penetrating coral reef',
    alt_ar: 'كانيون تحت الماء مع أشعة الشمس تخترق الشعاب المرجانية',
    category: 'diving',
    credit: 'Coral Sanctuary Project',
  },
  {
    url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1600&auto=format&fit=crop',
    filename: 'wadi-gnai.jpg',
    alt_en: 'Wadi Gnai canyon with granite boulders and palm trees',
    alt_ar: 'كانيون وادي قني مع صخور جرانيتية وأشجار نخيل',
    category: 'desert',
    credit: 'Bedouin Heritage Guides',
  },
  {
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1600&auto=format&fit=crop',
    filename: 'lighthouse-sunset.jpg',
    alt_en: 'Golden sunset over Lighthouse Bay promenade',
    alt_ar: 'غروب ذهبي فوق ممشى خليج اللايتهاوس',
    category: 'sunset',
    credit: 'Dahab Promenade Collective',
  },
  {
    url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1600&auto=format&fit=crop',
    filename: 'bedouin-campfire.jpg',
    alt_en: 'Bedouin campfire dinner under starlit sky',
    alt_ar: 'عشاء بدوي تحت نجوم السماء',
    category: 'bedouin',
    credit: 'Sinai Bedouin Cultural Circle',
  },
  // Explore categories (from dahabContent.ts)
  {
    url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=1200&auto=format&fit=crop',
    filename: 'explore-diving.jpg',
    alt_en: 'Diving category - underwater coral reef',
    alt_ar: 'فئة الغطس - شعاب مرجانية تحت الماء',
    category: 'diving',
    credit: 'Dahab Platform',
  },
  {
    url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1200&auto=format&fit=crop',
    filename: 'explore-adventure.jpg',
    alt_en: 'Adventure category - desert canyons',
    alt_ar: 'فئة المغامرة - وديان الصحراء',
    category: 'desert',
    credit: 'Dahab Platform',
  },
  {
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop',
    filename: 'explore-beach.jpg',
    alt_en: 'Beach category - turquoise coastal waters',
    alt_ar: 'فئة الشاطئ - مياه ساحلية فيروزية',
    category: 'lagoon',
    credit: 'Dahab Platform',
  },
  {
    url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop',
    filename: 'explore-food.jpg',
    alt_en: 'Food category - seaside dining',
    alt_ar: 'فئة الطعام - تناول الطعام على البحر',
    category: 'local',
    credit: 'Dahab Platform',
  },
  {
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1200&auto=format&fit=crop',
    filename: 'explore-local-life.jpg',
    alt_en: 'Local life category - Assalah market',
    alt_ar: 'فئة الحياة المحلية - سوق العصلة',
    category: 'local',
    credit: 'Dahab Platform',
  },
  // Cinematic hero scenes (from CinematicVideoHero.tsx)
  {
    url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2000&auto=format&fit=crop',
    filename: 'hero-reef.jpg',
    alt_en: 'Hero scene - coral reef underwater view',
    alt_ar: 'منظر البطل - شعاب مرجانية تحت الماء',
    category: 'diving',
    credit: 'Dahab Platform',
  },
  {
    url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=2000&auto=format&fit=crop',
    filename: 'hero-desert.jpg',
    alt_en: 'Hero scene - Sinai desert dunes',
    alt_ar: 'منظر البطل - كثبان صحراء سيناء',
    category: 'desert',
    credit: 'Dahab Platform',
  },
  {
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2000&auto=format&fit=crop',
    filename: 'hero-lagoon.jpg',
    alt_en: 'Hero scene - turquoise lagoon',
    alt_ar: 'منظر البطل - بحيرة فيروزية',
    category: 'lagoon',
    credit: 'Dahab Platform',
  },
  {
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=2000&auto=format&fit=crop',
    filename: 'hero-sunset.jpg',
    alt_en: 'Hero scene - golden sunset',
    alt_ar: 'منظر البطل - غروب ذهبي',
    category: 'sunset',
    credit: 'Dahab Platform',
  },
];

/**
 * Register all known media URLs as CMS media assets.
 * Skips URLs that are already registered.
 */
export function migrateMediaAssets(): void {
  const c = getConn();
  if (!c) return;

  // Only migrate if media table is empty
  const count = (c.prepare('SELECT COUNT(*) as n FROM cms_media').get() as { n: number })?.n ?? 0;
  if (count > 0) {
    console.log(`[CMS] Media table already has ${count} assets, skipping migration`);
    return;
  }

  // Filter through the same allowlist the upload endpoint uses — never auto-migrate
  // SVG or other script-capable types. Currently all KNOWN_MEDIA are .jpg but
  // the filter is load-bearing for future entries and legacy rows.
  const allowedExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
  const filtered = KNOWN_MEDIA.filter(m => {
    const ext = ('.' + (m.filename.split('.').pop() || '').toLowerCase());
    if (!allowedExts.has(ext)) {
      console.warn(`[CMS] Skipping disallowed media asset during migration: ${m.filename} (ext ${ext})`);
      return false;
    }
    return true;
  });
  // Keep mime consistent with the allowlist (image/jpeg for .jpg/.jpeg)
  const allowedMimes = new Set(ALLOWED_IMAGE_MIME_TYPES as readonly string[]);

  console.log(`[CMS] Migrating ${filtered.length} known media URLs to CMS...`);
  const ts = now();
  let registered = 0;

  for (const media of filtered) {
    try {
      const mimeForFile = media.filename.toLowerCase().endsWith('.png') ? 'image/png'
        : media.filename.toLowerCase().endsWith('.webp') ? 'image/webp'
        : media.filename.toLowerCase().endsWith('.gif') ? 'image/gif'
        : 'image/jpeg';
      if (!allowedMimes.has(mimeForFile)) {
        console.warn(`[CMS] Skipping disallowed MIME during migration: ${media.filename}`);
        continue;
      }
      c.prepare(`
        INSERT INTO cms_media (id, filename, original_url, storage_path, mime_type,
          file_size, width, height, aspect_ratio, alt_en, alt_ar, caption_en, caption_ar,
          credit, category, tags, usage_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id('MED'), media.filename, media.url, '', mimeForFile,
        0, 0, 0, '',
        media.alt_en, media.alt_ar, '', '',
        media.credit, media.category, '', 0,
        ts, ts
      );
      registered++;
    } catch (err: any) {
      console.warn(`[CMS] Failed to register ${media.filename}:`, err.message);
    }
  }

  console.log(`[CMS] Registered ${registered} media assets`);
}

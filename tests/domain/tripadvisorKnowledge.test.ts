import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { db } from '../../server/db/database';
import { resetDb } from '../helpers/fixtures';
import {
  detectKnowledgeQuery,
  searchKnowledge,
  answerKnowledge,
  __clearKnowledgeCache,
} from '../../server/services/tripadvisorKnowledgeService';

/**
 * Daygi's Tripadvisor knowledge layer: intent detection (EN/AR), ranked
 * search over the live catalogue (stays/dining) and the file-backed pulls
 * (attractions, tours, Nuweiba/Siwa), and bilingual grounded answers.
 */
describe('detectKnowledgeQuery', () => {
  it('detects restaurant intent in English and Arabic', () => {
    expect(detectKnowledgeQuery('best seafood restaurant in Dahab')).toEqual({
      destination: 'dahab',
      category: 'restaurant',
    });
    expect(detectKnowledgeQuery('عايز مطعم سمك حلو في دهب')).toEqual({
      destination: 'dahab',
      category: 'restaurant',
    });
  });

  it('detects hotels, attractions, tours and other destinations', () => {
    expect(detectKnowledgeQuery('where should I stay in Dahab?')?.category).toBe('hotel');
    expect(detectKnowledgeQuery('فنادق كويسة في دهب')?.category).toBe('hotel');
    expect(detectKnowledgeQuery('things to do in Nuweiba')?.category).toBe('attraction');
    expect(detectKnowledgeQuery('things to do in Nuweiba')?.destination).toBe('nuweiba');
    expect(detectKnowledgeQuery('رحلات في سيوة')?.category).toBe('tour');
    expect(detectKnowledgeQuery('رحلات في سيوة')?.destination).toBe('siwa');
    expect(detectKnowledgeQuery('diving in Dahab')?.category).toBe('attraction');
  });

  it('returns null for non-place questions', () => {
    expect(detectKnowledgeQuery('what is my trip budget?')).toBeNull();
    expect(detectKnowledgeQuery('hello')).toBeNull();
    expect(detectKnowledgeQuery('الجو عامل ايه؟')).toBeNull();
  });
});

describe('searchKnowledge over the live catalogue', () => {
  beforeEach(() => {
    resetDb();
    __clearKnowledgeCache();
    (db.accommodations as any[]).push(
      {
        id: 'HTL-A', name: 'Alpha Resort', nameAr: 'ألفا', active: true,
        rating: 4.8, reviewCount: 900, perNightEGP: 5000, areaName: 'Laguna',
        typeChips: ['Resort'],
        tripadvisor: {
          locationId: '1', url: 'https://example.com/1',
          reviews: [{ rId: 'r1', author: 'Sam', rating: 5, title: 'Great', text: 'Wonderful stay with amazing reef views and kind staff everywhere.' }],
        },
      },
      {
        id: 'HTL-B', name: 'Beta Camp', nameAr: 'بيتا', active: true,
        rating: 4.2, reviewCount: 200, perNightEGP: 800, areaName: 'Masbat',
        typeChips: ['Camp'],
        tripadvisor: { locationId: '2', url: 'https://example.com/2', reviews: [] },
      },
      {
        id: 'HTL-C', name: 'Gamma Lodge', nameAr: 'جاما', active: true,
        rating: 2.5, reviewCount: 5000, perNightEGP: 300, areaName: 'Assalah',
        typeChips: ['Lodge'],
        tripadvisor: { locationId: '3', url: 'https://example.com/3', reviews: [] },
      },
    );
    (db.diningVenues as any[]).push({
      id: 'dining_ta_9', nameEn: 'Shark Test Kitchen', nameAr: 'شارك',
      rating: 4.6, reviewCount: 1367, priceBand: 'Moderate ($$)', areaName: 'Masbat',
      cuisine: ['Seafood'], phone: '+20 100 000 0000',
      tripadvisor: {
        locationId: '9', url: 'https://example.com/9',
        reviews: [{ rId: 'r9', author: 'Laila', rating: 5, title: 'Fresh', text: 'The calamari and prawns were the freshest seafood we had in Dahab.' }],
      },
    });
  });

  it('ranks hotels by rating then review count, dropping sub-3.0 rows', () => {
    const { places, totalMatching } = searchKnowledge('dahab', 'hotel', 'best hotel in Dahab');
    expect(totalMatching).toBe(2);
    expect(places.map((p) => p.name)).toEqual(['Alpha Resort', 'Beta Camp']);
    expect(places[0].reviewQuote?.author).toBe('Sam');
    expect(places[0].price).toBe('EGP 5000/night');
  });

  it('filters dining by cuisine terms', () => {
    const { places } = searchKnowledge('dahab', 'restaurant', 'seafood restaurant');
    expect(places.map((p) => p.name)).toEqual(['Shark Test Kitchen']);
    expect(places[0].phone).toBe('+20 100 000 0000');
  });

  it('answers Arabic prompts with top-rated rows', () => {
    const ans = answerKnowledge('عايز مطعم سمك حلو في دهب');
    expect(ans).not.toBeNull();
    expect(ans!.places[0].name).toBe('Shark Test Kitchen');
    expect(ans!.replyText).toContain('Shark Test Kitchen');
    expect(ans!.replyTextAr).toContain('Shark Test Kitchen');
    expect(ans!.replyTextAr).toContain('دهب');
  });

  it('returns null when nothing matches', () => {
    expect(answerKnowledge('best sushi restaurant in Dahab')).toBeNull();
  });
});

describe('searchKnowledge over file-backed pulls', () => {
  let tmpDir: string;
  const prevDataDir = process.env.DAHAB_DATA_DIR;

  beforeEach(() => {
    resetDb();
    __clearKnowledgeCache();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ta-know-'));
    fs.mkdirSync(path.join(tmpDir, 'tripadvisor'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'tripadvisor', 'siwa_attractions.json'),
      JSON.stringify({
        places: [
          { id: 101, name: 'Oracle Temple of Amun', url: '/x', rating: 4.7, reviewCount: 300, category: 'Ancient Ruins' },
          { id: 102, name: 'Cleopatra Spring', url: '/y', rating: 4.3, reviewCount: 150, category: 'Nature' },
        ],
      }),
    );
    fs.writeFileSync(
      path.join(tmpDir, 'tripadvisor', 'reviews.json'),
      JSON.stringify({ 101: { reviews: [{ rId: 's1', author: 'Omar', rating: 5, title: 'Magical', text: 'The sunset over the temple ruins was unforgettable and peaceful.' }] } }),
    );
    process.env.DAHAB_DATA_DIR = tmpDir;
  });

  afterEach(() => {
    if (prevDataDir === undefined) delete process.env.DAHAB_DATA_DIR;
    else process.env.DAHAB_DATA_DIR = prevDataDir;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    __clearKnowledgeCache();
  });

  it('loads Siwa attractions from the pull files with review quotes', () => {
    const { places } = searchKnowledge('siwa', 'attraction', 'things to do in Siwa');
    expect(places.map((p) => p.name)).toEqual(['Oracle Temple of Amun', 'Cleopatra Spring']);
    expect(places[0].reviewQuote?.author).toBe('Omar');
  });

  it('returns empty when the pull files are absent (fresh deploy)', () => {
    fs.rmSync(path.join(tmpDir, 'tripadvisor'), { recursive: true, force: true });
    __clearKnowledgeCache();
    const { places, totalMatching } = searchKnowledge('siwa', 'attraction', 'things to do in Siwa');
    expect(places).toEqual([]);
    expect(totalMatching).toBe(0);
    expect(answerKnowledge('things to do in Siwa')).toBeNull();
  });
});

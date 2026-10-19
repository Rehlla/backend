/**
 * ScrapeGraph AI fetch script — pulls structured data from travel websites
 * and writes raw JSON to data/ for later import via the seed importer.
 *
 * Usage:
 *   npx tsx scripts/scrapegraph-fetch.ts --source=hotels [--limit=10]
 *   npx tsx scripts/scrapegraph-fetch.ts --source=activities
 *   npx tsx scripts/scrapegraph-fetch.ts --source=prices --hotel=HTL-01
 *
 * Requires SCRAPEGRAPH_API_KEY in .env
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initScrapeGraph, scrapeHotelDetails, scrapeHotelPrice, scrapeBulk } from '../server/services/scrapeGraphService.js';

// ─── Config ──────────────────────────────────────────────────────────────────

interface CliArgs {
  source: 'hotels' | 'activities' | 'prices';
  limit?: number;
  hotel?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: Partial<CliArgs> = {};

  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    switch (key) {
      case 'source':
        parsed.source = value as CliArgs['source'];
        break;
      case 'limit':
        parsed.limit = parseInt(value, 10);
        break;
      case 'hotel':
        parsed.hotel = value;
        break;
      case 'checkIn':
        parsed.checkIn = value;
        break;
      case 'checkOut':
        parsed.checkOut = value;
        break;
      case 'guests':
        parsed.guests = parseInt(value, 10);
        break;
    }
  }

  if (!parsed.source) {
    console.error('Usage: npx tsx scripts/scrapegraph-fetch.ts --source=hotels|activities|prices');
    process.exit(1);
  }

  return parsed as CliArgs;
}

// ─── Env ─────────────────────────────────────────────────────────────────────

function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  }
}

// ─── Data sources ────────────────────────────────────────────────────────────

const HOTEL_URLS = [
  'https://www.tripadvisor.com/Hotels-g297547-Dahab_South_Sinai_Red_Sea_and_Sinai-Hotels.html',
  'https://www.booking.com/city/eg/dhahab.en.html?aid=1610684;label=dhahab-_MIPMZBZN3T5GiTsLmKEtgS379614582198:pl:ta:p1:p2:ac:ap:neg:fi:tikwd-13314956200:lp9261640:li:dec:dm:ppccp=UmFuZG9tSVYkc2RlIyh9YfqnDqqG8nt10AsofPfvtt0;ws=&gad_source=1&gad_campaignid=1573322608&gbraid=0AAAAAD_Ls1KZzNsyY4p0LYiHxXYlm1IvP&gclid=CjwKCAjwuczWBhA9EiwAYGgEoRJ7gN--iBqd_p8JHvIXKWTUsyEm1wGLi_y-jRYCZt5rLYVKf-GeWhoCC0wQAvD_BwE',
  'https://www.tripadvisor.com/Hotels-g297551-Nuweiba_South_Sinai_Red_Sea_and_Sinai-Hotels.html',
  'https://www.booking.com/searchresults.html?aid=1610684&label=nuwaybi-n6GuDnsHs%2AWnTaS32Tj68AS541115125158%3Apl%3Ata%3Ap1%3Ap2%3Aac%3Aap%3Aneg%3Afi%3Atikwd-305534302222%3Alp9261640%3Ali%3Adec%3Adm%3Appccp%3DUmFuZG9tSVYkc2RlIyh9YfqnDqqG8nt10AsofPfvtt0&gclid=CjwKCAjwuczWBhA9EiwAYGgEoRwvyvuVqCu210ChwsHT7BBDCnpzHNsJLLrfddaIlAhKYFEZH0cLcxoCjjsQAvD_BwE&dest_type=city&dest_id=-300490&redirected_from_city=1&redirected=1&source=city&keep_landing=1&sid=9620a46bc9fdb7bee31b7c429ce3ec9e',
  'https://www.tripadvisor.com/Hotels-g303857-Siwa_Matrouh_Governorate-Hotels.html',
  'https://www.booking.com/searchresults.html?aid=356980&label=gog235jc-10CAMoQ0IKc2l3YS1vYXNpc0gzWANoQ4gBAZgBM7gBF8gBDNgDA-gBAfgBAYgCAagCAbgCtq3Q1gbAAgHSAiQ1MzEzYjRiMy0zMDJmLTRlYjAtOTAyZi03ZDg1YjRmZTY2NDXYAgHgAgE&city=900063059',
  'https://www.airbnb.com/s/Dahab--Egypt/homes?place_id=ChIJX1itvylLqxURvxkzeY0jZaw&refinement_paths%5B%5D=%2Fhomes&checkin=2026-10-25&checkout=2026-10-26&date_picker_type=calendar&adults=1&guests=1&search_type=HOMEPAGE_CAROUSEL_CLICK',
  'https://www.airbnb.com/s/Nuweiba--Egypt/homes?adults=1&refinement_paths%5B%5D=%2Fhomes&property_type_id%5B%5D=42&place_id=ChIJRz-OQnYkVRQRM9co1YxqbX4&location=Nuweiba%2C+Egypt',
  'https://www.airbnb.com/s/Siwa-Oasis--Egypt/homes?adults=1&refinement_paths%5B%5D=%2Fhomes&place_id=ChIJI6Xz6KyvehQRTQea8fhdM28&location=Siwa+Oasis%2C+Egypt',
];

const ACTIVITY_URLS = [
  'https://www.tripadvisor.com/Attractions-g297547-Activities-oa0-Dahab_South_Sinai_Red_Sea_and_Sinai.html',
  'https://www.tripadvisor.com/Attractions-g297551-Activities-Nuweiba_South_Sinai_Red_Sea_and_Sinai.html',
  'https://www.tripadvisor.com/Attractions-g303857-Activities-c42-Siwa_Matrouh_Governorate.html',
];

const RESTAURANT_URLS = [
  'https://www.tripadvisor.com/Restaurants-g297547-Dahab_South_Sinai_Red_Sea_and_Sinai.html',
  'https://www.tripadvisor.com/Restaurants-g297551-Nuweiba_South_Sinai_Red_Sea_and_Sinai.html',
  'https://www.tripadvisor.com/Restaurants-g303857-Siwa_Matrouh_Governorate.html',
];

const PRICE_URLS: Record<string, string> = {
  'HTL-01': 'https://www.booking.com/hotel/eg/swiss-inn-resort-dahab.html',
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadEnv();
  initScrapeGraph(process.env.SCRAPEGRAPH_API_KEY);

  if (!process.env.SCRAPEGRAPH_API_KEY) {
    console.error('ERROR: SCRAPEGRAPH_API_KEY is not set in .env');
    process.exit(1);
  }

  const args = parseArgs();
  console.log(`ScrapeGraph fetch: source=${args.source}${args.limit ? `, limit=${args.limit}` : ''}`);

  const outputPath = resolve(process.cwd(), 'data', `scrapegraph_${args.source}.json`);

  try {
    switch (args.source) {
      case 'hotels': {
        const urls = args.limit ? HOTEL_URLS.slice(0, args.limit) : HOTEL_URLS;
        const results = await scrapeBulk(
          urls,
          'Extract hotel name, star rating, review count, amenities, description, images, address, and nightly price.',
        );
        writeFileSync(outputPath, JSON.stringify({ fetchedAt: new Date().toISOString(), results }, null, 2));
        console.log(`Wrote ${results.length} hotel results to ${outputPath}`);
        break;
      }

      case 'activities': {
        const urls = args.limit ? ACTIVITY_URLS.slice(0, args.limit) : ACTIVITY_URLS;
        const results = await scrapeBulk(
          urls,
          'Extract activity name, description, duration, price, what is included, rating, and images.',
        );
        writeFileSync(outputPath, JSON.stringify({ fetchedAt: new Date().toISOString(), results }, null, 2));
        console.log(`Wrote ${results.length} activity results to ${outputPath}`);
        break;
      }

      case 'prices': {
        const hotelId = args.hotel ?? 'HTL-01';
        const url = PRICE_URLS[hotelId];
        if (!url) {
          console.error(`No URL configured for hotel ${hotelId}`);
          process.exit(1);
        }
        const price = await scrapeHotelPrice(
          hotelId,
          url,
          args.checkIn ?? '2026-11-01',
          args.checkOut ?? '2026-11-06',
          args.guests ?? 2,
        );
        writeFileSync(outputPath, JSON.stringify({ fetchedAt: new Date().toISOString(), hotelId, price }, null, 2));
        console.log(`Wrote price for ${hotelId} to ${outputPath}`);
        break;
      }
    }

    console.log('Done. Run the importer to load this data into the database.');
  } catch (err) {
    console.error('ScrapeGraph fetch failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();

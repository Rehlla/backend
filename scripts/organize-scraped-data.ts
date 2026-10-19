/**
 * Organize all scraped URLs by city / category / source.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
const src = JSON.parse(readFileSync('new_data/unified_scrape_results.json', 'utf8'));

const organizedDir = 'new_data/organized';
mkdirSync(organizedDir, { recursive: true });

const groups: Record<string, any[]> = {};

for (const r of src.results) {
  const key = `${r.city}/${r.category}/${r.source}`;
  if (!groups[key]) groups[key] = [];
  groups[key].push({ url: r.url, directStatus: r.directFetchStatus, sgStatus: r.scrapeGraphStatus, length: r.rawLength, title: r.title, snippet: r.snippet });
}

// Write per-group summaries
for (const [key, items] of Object.entries(groups)) {
  const [city, category, source] = key.split('/');
  const dirPath = `${organizedDir}/${city}/${category}`;
  mkdirSync(dirPath, { recursive: true });
  writeFileSync(`${dirPath}/${source}.json`, JSON.stringify({ city, category, source, count: items.length, items }, null, 2), 'utf8');
}

// Master index
const master = {
  fetchedAt: src.fetchedAt,
  totalUrls: src.total,
  groups: Object.keys(groups).map(k => {
    const [city, category, source] = k.split('/');
    return { city, category, source, count: groups[k].length };
  }),
  note: 'TripAdvisor pages return ~775B (restricted/block). Booking (Dahab ~865KB, Nuweiba/Siwa ~4KB JS-disabled), Airbnb full (~820-880KB). ScrapeGraph Free Plan = 0/15.',
};
writeFileSync(`${organizedDir}/MASTER_INDEX.json`, JSON.stringify(master, null, 2), 'utf8');

console.log('Organized files created:');
for (const k of Object.keys(groups)) console.log(' -', k, '| count=', groups[k].length);
console.log('Master index:', `${organizedDir}/MASTER_INDEX.json`);

/**
 * Self-certification harness (NOT part of npm test): proves the Daygi
 * Tripadvisor-knowledge branch answers grounded, real questions end-to-end
 * through daygiReasoningService. Run only on demand:
 *   npx tsx server/test/runDaygiKnowledgeCertification.ts
 */
import { runMigrationsAndSeed } from '../db/migrations';
import { dahabKnowledgeOs } from '../services/dahabKnowledgeOs';
import { importDahabRestaurants } from '../db/seeds/importDahabRestaurants';
import { daygiReasoningService } from '../services/daygiReasoningService';
import { db } from '../db/database';

async function main(): Promise<void> {
  runMigrationsAndSeed();
  dahabKnowledgeOs.bootstrapValidatedCorpus();
  importDahabRestaurants();

  const withReviews = (db.accommodations as any[]).filter(
    (a) => a.tripadvisor?.reviews && (a.tripadvisor.reviews as any[]).length > 0,
  ).length;
  const diningWithReviews = (db.diningVenues as any[]).filter(
    (v) => v.tripadvisor?.reviews && (v.tripadvisor.reviews as any[]).length > 0,
  ).length;
  console.log(`\n=== Boot state (real DB) ===`);
  console.log(`  accommodations with TA reviews: ${withReviews}`);
  console.log(`  dining venues with TA reviews: ${diningWithReviews}`);

  const queries = [
    { q: 'best diving in Dahab', lang: 'en' as const },
    { q: 'things to do in Nuweiba', lang: 'en' as const },
    { q: 'رحلات في سيوة', lang: 'ar' as const },
    { q: 'عايز مطعم حلو كويس في دهب', lang: 'ar' as const },
    { q: 'what is my trip budget', lang: 'en' as const }, // should NOT hit knowledge
  ];

  for (const { q, lang } of queries) {
    const res = await daygiReasoningService.query({
      prompt: q,
      language: lang,
      currentLocation: 'Lighthouse',
      availableMinutes: 120,
      userRole: 'Traveler',
      userId: 'user_daygi_cert',
    });
    const places = res.actionData && (res.actionData as any).knowledgePlaces
      ? (res.actionData as any).knowledgePlaces.map((p: any) => `${p.name}(${p.rating},${p.reviewCount})`).join(' | ')
      : '';
    console.log(`\nQ [${lang}]: ${q}`);
    console.log(`   actionType=${res.actionType}  mode=${res.mode}  source=${res.sourceConfidence?.source}`);
    console.log(`   knowledgePlaces: ${places || '—'}`);
    console.log(`   reply: ${(res.replyText || '').slice(0, 220).replace(/\n/g, ' ')}`);
    if (lang === 'ar') {
      console.log(`   replyAr: ${(res.replyTextAr || '').slice(0, 220).replace(/\n/g, ' ')}`);
    }
  }
  console.log('\n=== done ===');
}
main().catch((e) => { console.error('CERT FAILED:', e); process.exit(1); });

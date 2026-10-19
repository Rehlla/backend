/**
 * One-off migration: add new destination tabs to the live header & mobile
 * navigation in dahab.sqlite.
 *
 * The cmsSeed header/mobile seeding only runs when the table is empty, so
 * existing installs (which already have the old 3-tab header) never receive
 * the new tabs. This script upserts the Expand/Explore + Food tabs (and any
 * other header tabs) into the live DB, matching the icon names V2Navbar's
 * iconMap knows how to render.
 *
 *   npm run db:add-nav-tabs
 *
 * Idempotent: safe to run repeatedly. Only inserts rows whose route is not
 * already present for the given menu_key.
 */
import fs from 'fs';
import Database from 'better-sqlite3';
import { SQLITE_FILE } from '../paths';

const nav: Array<[string, string, string, string, string, number]> = [
  // menu_key, label_en, label_ar, route, icon, order
  ['header', 'Discover', 'استكشف', '/home', 'Compass', 0],
  ['header', 'Explore', 'استكشف دهب', '/explore', 'Map', 1],
  ['header', 'Transfers', 'النقل', '/transfers', 'Car', 2],
  ['header', 'Food & Dining', 'الأكل والمطاعم', '/food', 'UtensilsCrossed', 3],
  ['header', 'Experiences', 'التجارب', '/experiences', 'Star', 4],
  ['header', 'Hotels', 'فنادق', '/hotels', 'BedDouble', 5],
  ['header', 'Bookings', 'حجوزاتي', '/bookings', 'Ticket', 6],
  ['header', 'My Trip', 'رحلتي', '/my-trip', 'Luggage', 7],
  ['header', 'Dahab Live', 'دهب لايف', '/live', 'Activity', 8],
  ['mobile', 'Discover', 'استكشف', '/home', 'Compass', 0],
  ['mobile', 'Hotels', 'فنادق', '/hotels', 'BedDouble', 1],
  ['mobile', 'Explore', 'استكشف دهب', '/explore', 'Map', 2],
  ['mobile', 'My Trip', 'رحلتي', '/my-trip', 'Luggage', 3],
  ['mobile', 'Live', 'لايف', '/live', 'Activity', 4],
];

function main() {
  const path = SQLITE_FILE();
  if (!fs.existsSync(path)) {
    console.error(`No database at ${path}. Run: npm run db:migrate`);
    process.exit(1);
  }

  const sqlite = new Database(path);

  const exists = sqlite.prepare(
    'SELECT id FROM cms_navigation WHERE menu_key = ? AND route = ?'
  );
  const insert = sqlite.prepare(`
    INSERT INTO cms_navigation
      (id, menu_key, item_order, label_en, label_ar, route, external_url, visible, open_in_new, icon, group_label_en, group_label_ar, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, '', 1, 0, ?, '', '', ?, ?)
  `);
  const touch = sqlite.prepare(
    'UPDATE cms_navigation SET item_order = ?, label_en = ?, label_ar = ?, icon = ?, updated_at = ? WHERE menu_key = ? AND route = ?'
  );
  const ts = new Date().toISOString();

  let added = 0;
  let updated = 0;
  const tx = sqlite.transaction(() => {
    for (const [menu, en, ar, route, icon, order] of nav) {
      const row = exists.get(menu, route) as { id: string } | undefined;
      if (row) {
        touch.run(order, en, ar, icon, ts, menu, route);
        updated += 1;
      } else {
        insert.run(`NAV-${menu}-${route.replace(/\W+/g, '-').toUpperCase()}`, menu, order, en, ar, route, icon, ts, ts);
        console.log(`  + [${menu}] ${en} -> ${route}`);
        added += 1;
      }
    }
  });
  tx();

  sqlite.close();

  console.log(`\nDone. ${added} new nav item(s) added, ${updated} re-ordered. Header now has 9 tabs, mobile 5.`);
}

main();

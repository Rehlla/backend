/**
 * Consistent backup of the SQLite store.
 *
 *   npm run db:backup
 *
 * Thin CLI over server/services/backupService.ts (scheduling, retention and
 * verification live there so the server and the test suite share them).
 */
import { runBackup, pruneBackups, backupConfig } from '../../services/backupService';

function main() {
  const { keep } = backupConfig();
  const result = runBackup();
  const { removed } = pruneBackups(keep);

  console.log(`${result.file}`);
  console.log(`  ${result.sizeMB.toFixed(2)} MB · integrity ok · ${result.users} users`);
  if (removed.length > 0) console.log(`  pruned ${removed.length} old backup(s) (keeping ${keep})`);
}

try {
  main();
} catch (err: any) {
  console.error(err?.message || err);
  process.exit(1);
}

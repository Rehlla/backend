import path from 'path';

/**
 * Where the platform reads seeds from, and where it writes state to.
 *
 * These were the same directory, which is why the container could not keep its
 * data. `data/` held two different kinds of file with opposite requirements:
 *
 *   - Seeds (dahab_local_commerce.json, instagram/) are build inputs. They are
 *     baked into the image, read at boot, and never written.
 *   - State (dahab.sqlite, locks/, daygi_tasks.json, backups/) is everything the
 *     platform produces and must not lose.
 *
 * Mounting a volume over a directory hides whatever the image put there, so
 * with both in `data/` you had to choose between persisting the database and
 * being able to boot at all. Splitting them means the volume covers only the
 * state directory and the seeds stay readable underneath.
 *
 * Local development changes nothing: both default to `<cwd>/data`, exactly
 * where they are today.
 */

/** Runtime state. Mount a volume here in production. */
export const DATA_DIR = process.env.DAHAB_DATA_DIR
  ? path.resolve(process.env.DAHAB_DATA_DIR)
  : path.join(process.cwd(), 'data');

/**
 * Lazy version of DATA_DIR for code that must honor late env changes
 * (tests pointing at temp dirs, tooling). Same resolution, read per call.
 */
export function dataDir(): string {
  return process.env.DAHAB_DATA_DIR
    ? path.resolve(process.env.DAHAB_DATA_DIR)
    : path.join(process.cwd(), 'data');
}

/** Read-only seed datasets baked into the image. */
export const SEED_DIR = process.env.DAHAB_SEED_DIR
  ? path.resolve(process.env.DAHAB_SEED_DIR)
  : path.join(process.cwd(), 'data');

export const dataPath = (...segments: string[]) => path.join(DATA_DIR, ...segments);
export const seedPath = (...segments: string[]) => path.join(SEED_DIR, ...segments);

export const SQLITE_FILE = () => dataPath('dahab.sqlite');
export const JSON_STORE_FILE = () => dataPath('dahab_db.json');
export const backupDir = () => dataPath('backups');
export const LOCKS_DIR = () => dataPath('locks');

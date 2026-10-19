import fs from 'fs';
import path from 'path';

/**
 * Service to sync and organize real Dahab photography from local desktop storage
 * into the public web asset directory (`public/images/`).
 */
export class MediaAssetService {
  /**
   * One-time migration source (a dev-machine folder, long gone). Overridable
   * via MEDIA_SOURCE_DIR for operators re-running the import elsewhere; when
   * the directory is absent the sync is a silent no-op — the migrated assets
   * already live in public/images/ and the CMS media table.
   */
  private static readonly SOURCE_DIR =
    process.env.MEDIA_SOURCE_DIR ||
    'C:\\Users\\mohamed\\OneDrive - newtecx\\Desktop\\dahab images';
  private static readonly DEST_ROOT = path.join(process.cwd(), 'public', 'images');

  /**
   * Mapping definitions from source filenames to organized public destinations.
   */
  private static readonly ASSET_MAPPINGS: Array<{
    subfolder: string;
    sourceFile: string;
    destFile: string;
  }> = [
    // --- Hero & Section Backgrounds ---
    { subfolder: 'hero', sourceFile: '2024_2_21_13_40_33_838.jpg', destFile: 'camels-beach.jpg' },
    { subfolder: 'hero', sourceFile: '2022_8_8_21_2_44_616.jpg', destFile: 'boho-cafe-dreams.jpg' },
    { subfolder: 'hero', sourceFile: '2022_8_7_17_57_15_94.jpg', destFile: 'coral-reef-split.jpg' },
    { subfolder: 'hero', sourceFile: 'blue-lagoon.jpg', destFile: 'blue-lagoon-kitesurf.jpg' },
    { subfolder: 'hero', sourceFile: '2024_2_21_13_42_24_429.jpg', destFile: 'gulf-sunset.jpg' },
    { subfolder: 'hero', sourceFile: 'the-golden-beach-in-swiss.jpg', destFile: 'golden-beach.jpg' },

    // --- Attractions & Natural Sights ---
    { subfolder: 'attractions', sourceFile: 'blue-hole.jpg', destFile: 'blue-hole.jpg' },
    { subfolder: 'attractions', sourceFile: 'group-diving-at-the-blue.jpg', destFile: 'blue-hole-divers.jpg' },
    { subfolder: 'attractions', sourceFile: 'deco-stop-near-the-saddle.jpg', destFile: 'blue-hole-deco.jpg' },
    { subfolder: 'attractions', sourceFile: 'blue-hole-view.jpg', destFile: 'blue-hole-view.jpg' },
    { subfolder: 'attractions', sourceFile: '2024_2_21_16_16_53_230.jpg', destFile: 'underwater-elephant.jpg' },
    { subfolder: 'attractions', sourceFile: 'beautiful-corals-with.jpg', destFile: 'coral-gardens.jpg' },
    { subfolder: 'attractions', sourceFile: 'three-pools.jpg', destFile: 'three-pools.jpg' },
    { subfolder: 'attractions', sourceFile: 'bouldering.jpg', destFile: 'bouldering-wadi-gnai.jpg' },
    { subfolder: 'attractions', sourceFile: '2024_2_21_13_42_25_23.jpg', destFile: 'mountain-ridge-bay.jpg' },
    { subfolder: 'attractions', sourceFile: 'palma-bedouin-safari.jpg', destFile: 'ras-abu-galum-spit.jpg' },
    { subfolder: 'attractions', sourceFile: 'yalla-dahab-safari-day.jpg', destFile: 'sinai-desert-safari.jpg' },
    { subfolder: 'attractions', sourceFile: 'big-devil-scorpionfish.jpg', destFile: 'scorpionfish.jpg' },
    { subfolder: 'attractions', sourceFile: 'nemo.jpg', destFile: 'clownfish-nemo.jpg' },
    { subfolder: 'attractions', sourceFile: 'light-house.jpg', destFile: 'lighthouse-reef.jpg' },
    { subfolder: 'attractions', sourceFile: 'housereef.jpg', destFile: 'house-reef.jpg' },

    // --- Hotels & Resorts ---
    { subfolder: 'hotels', sourceFile: 'swiss-inn-resort.jpg', destFile: 'swiss-inn-resort.jpg' },
    { subfolder: 'hotels', sourceFile: 'swiss-inn-resort (2).jpg', destFile: 'swiss-inn-resort-2.jpg' },
    { subfolder: 'hotels', sourceFile: 'swiss-inn-resort (3).jpg', destFile: 'swiss-inn-resort-3.jpg' },
    { subfolder: 'hotels', sourceFile: 'tropitel-dahab-oasis.jpg', destFile: 'tropitel-dahab-oasis.jpg' },
    { subfolder: 'hotels', sourceFile: 'tropitel-dahab-oasis (2).jpg', destFile: 'tropitel-dahab-oasis-2.jpg' },
    { subfolder: 'hotels', sourceFile: 'tropitel-dahab-oasis (3).jpg', destFile: 'tropitel-dahab-oasis-3.jpg' },
    { subfolder: 'hotels', sourceFile: 'tropitel-dahab-oasis (7).jpg', destFile: 'tropitel-dahab-oasis-pool.jpg' },
    { subfolder: 'hotels', sourceFile: 'dahab-paradise.jpg', destFile: 'dahab-paradise.jpg' },
    { subfolder: 'hotels', sourceFile: 'dahab-paradise (2).jpg', destFile: 'dahab-paradise-2.jpg' },
    { subfolder: 'hotels', sourceFile: 'dahab-paradise (3).jpg', destFile: 'dahab-paradise-3.jpg' },
    { subfolder: 'hotels', sourceFile: 'daniela-village-dahab.jpg', destFile: 'daniela-village.jpg' },
    { subfolder: 'hotels', sourceFile: 'daniela-village-dahab (2).jpg', destFile: 'daniela-village-2.jpg' },
    { subfolder: 'hotels', sourceFile: 'happy-life-village.jpg', destFile: 'happy-life-village.jpg' },
    { subfolder: 'hotels', sourceFile: 'happy-life-village (2).jpg', destFile: 'happy-life-village-2.jpg' },
    { subfolder: 'hotels', sourceFile: 'ibis-styles-dahab-lagoon.jpg', destFile: 'ibis-styles-lagoon.jpg' },
    { subfolder: 'hotels', sourceFile: 'ibis-styles-dahab-lagoon (2).jpg', destFile: 'ibis-styles-lagoon-2.jpg' },
    { subfolder: 'hotels', sourceFile: 'le-meridien-dahab-resort.jpg', destFile: 'le-meridien.jpg' },
    { subfolder: 'hotels', sourceFile: 'le-meridien-dahab-resort (2).jpg', destFile: 'le-meridien-2.jpg' },
    { subfolder: 'hotels', sourceFile: 'sindbad-camp.jpg', destFile: 'sindbad-camp.jpg' },
    { subfolder: 'hotels', sourceFile: 'panda-resort.jpg', destFile: 'panda-resort.jpg' },
    { subfolder: 'hotels', sourceFile: 'ghazala-hotel.jpg', destFile: 'ghazala-hotel.jpg' },
    { subfolder: 'hotels', sourceFile: 'sea-sun-hotel-dahab.jpg', destFile: 'sea-sun-hotel.jpg' },
    { subfolder: 'hotels', sourceFile: 'nesima-resort-and-dive.jpg', destFile: 'nesima-resort.jpg' },
    { subfolder: 'hotels', sourceFile: 'el-primo-hotel-dahab.jpg', destFile: 'el-primo.jpg' },
    { subfolder: 'hotels', sourceFile: 'the-bedouin-moon-hotel.jpg', destFile: 'bedouin-moon.jpg' },
    { subfolder: 'hotels', sourceFile: 'red-rock-apartments.jpg', destFile: 'red-rock.jpg' },
    { subfolder: 'hotels', sourceFile: 'ganet-sinai-hotel.jpg', destFile: 'ganet-sinai.jpg' },
    { subfolder: 'hotels', sourceFile: 'hilton-dahab.jpg', destFile: 'hilton-dahab.jpg' },

    // --- Restaurants & Cafes ---
    { subfolder: 'restaurants', sourceFile: 'ali-baba-restaurant.jpg', destFile: 'ali-baba-restaurant.jpg' },
    { subfolder: 'restaurants', sourceFile: 'the-roof-restaurant.jpg', destFile: 'the-roof-restaurant.jpg' },
    { subfolder: 'restaurants', sourceFile: '2022_8_8_21_2_44_616.jpg', destFile: 'boho-beach-cafe.jpg' },
    { subfolder: 'restaurants', sourceFile: '2022_8_8_21_9_23_615.jpg', destFile: 'bedouin-crafts-market.jpg' },
    { subfolder: 'restaurants', sourceFile: 'where-we-would-eat-breakfast.jpg', destFile: 'breakfast-by-the-sea.jpg' },
  ];

  /**
   * Run synchronization. Creates target folders and copies assets if needed.
   */
  public static syncDahabMediaAssets(): { copied: number; skipped: number; total: number } {
    if (!fs.existsSync(this.SOURCE_DIR)) {
      // Silent when the legacy default is absent (normal: migration done).
      // Loud only when an operator explicitly configured a missing path.
      if (process.env.MEDIA_SOURCE_DIR) {
        console.warn(`[MediaAssetService] Source directory not found: ${this.SOURCE_DIR}`);
      }
      return { copied: 0, skipped: 0, total: 0 };
    }

    const subfolders = ['hero', 'attractions', 'hotels', 'restaurants', 'gallery'];
    for (const sub of subfolders) {
      const targetSub = path.join(this.DEST_ROOT, sub);
      if (!fs.existsSync(targetSub)) {
        fs.mkdirSync(targetSub, { recursive: true });
      }
    }

    let copied = 0;
    let skipped = 0;

    for (const mapping of this.ASSET_MAPPINGS) {
      const srcPath = path.join(this.SOURCE_DIR, mapping.sourceFile);
      const destPath = path.join(this.DEST_ROOT, mapping.subfolder, mapping.destFile);

      if (!fs.existsSync(srcPath)) {
        continue;
      }

      try {
        if (fs.existsSync(destPath)) {
          const srcStat = fs.statSync(srcPath);
          const destStat = fs.statSync(destPath);
          if (srcStat.size === destStat.size) {
            skipped++;
            continue;
          }
        }

        fs.copyFileSync(srcPath, destPath);
        copied++;
      } catch (err: any) {
        console.error(`[MediaAssetService] Failed to copy ${mapping.sourceFile} -> ${destPath}:`, err.message);
      }
    }

    // Also copy all original photos directly into public/images/gallery/
    try {
      const allFiles = fs.readdirSync(this.SOURCE_DIR);
      const galleryDir = path.join(this.DEST_ROOT, 'gallery');
      for (const file of allFiles) {
        if (file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg') || file.toLowerCase().endsWith('.png')) {
          const src = path.join(this.SOURCE_DIR, file);
          const dest = path.join(galleryDir, file);
          if (!fs.existsSync(dest)) {
            try {
              fs.copyFileSync(src, dest);
              copied++;
            } catch {}
          }
        }
      }
    } catch (err: any) {
      console.warn('[MediaAssetService] Gallery sync notice:', err.message);
    }

    console.log(`[MediaAssetService] Synced Dahab images: ${copied} copied, ${skipped} already up to date.`);
    return { copied, skipped, total: this.ASSET_MAPPINGS.length };
  }
}

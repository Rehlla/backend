import fs from 'fs';
import crypto from 'crypto';
import { dataPath } from '../db/paths';
import type {
  DayGiChatRecord,
  DayGiStoredChatMessage
} from '../../src/shared';

/**
 * Public snapshot links ("Share chat").
 *
 * A share freezes one conversation into an immutable, unguessable-address
 * snapshot that anyone with the link can read — the TripAdvisor "anyone with
 * this link can view up to the point you shared it" contract. New turns never
 * appear in an existing snapshot; sharing again mints a new link.
 *
 * Privacy properties (deliberate):
 * - IDs are 128-bit crypto random (SHR- + 32 hex chars): unlistable and
 *   unguessable. There is no list-shares endpoint.
 * - Lookup is by shareId alone with no owner check — possession of the link
 *   IS the authorization, exactly like the product being mirrored.
 * - The snapshot carries the transcript text plus the plan canvas only.
 *   Trip health, bookings, holds and anything else in the payload stays out.
 * - Deleting the source chat deletes its snapshots with it.
 */

export interface DayGiShareCanvasDay {
  label: string;
  labelAr: string;
  title?: string;
  titleAr?: string;
  items: Array<{
    name: string;
    nameAr: string;
    blurb?: string;
    blurbAr?: string;
    priceEGP?: number;
    time?: string;
    location?: string;
    rating?: number;
    reviewCount?: number;
  }>;
}

export interface DayGiShareRecord {
  shareId: string;
  chatId: string;
  userId: string;
  title: string;
  createdAt: string;
  messages: Array<{
    id: string;
    sender: 'user' | 'daygi';
    text: string;
    timestamp: string;
  }>;
  canvasDays: DayGiShareCanvasDay[];
}

function snapshotCanvas(messages: DayGiStoredChatMessage[]): DayGiShareCanvasDay[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const canvas = messages[i].responsePayload?.canvas;
    if (!canvas) continue;
    return canvas.days.map(day => ({
      label: day.label,
      labelAr: day.labelAr,
      title: day.title,
      titleAr: day.titleAr,
      items: day.items.map(item => ({
        name: item.name,
        nameAr: item.nameAr,
        blurb: item.blurb,
        blurbAr: item.blurbAr,
        priceEGP: item.priceEGP,
        time: item.time,
        location: item.location,
        rating: item.rating,
        reviewCount: item.reviewCount
      }))
    }));
  }
  return [];
}

interface SerializedShares {
  shares: Array<[string, DayGiShareRecord]>;
  savedAt: string;
}

export class DayGiShareStore {
  private shares = new Map<string, DayGiShareRecord>();

  constructor(private readonly filePath: string) {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as SerializedShares;
      if (!Array.isArray(parsed.shares)) return;
      for (const [shareId, record] of parsed.shares) {
        if (record && typeof record === 'object') this.shares.set(shareId, record);
      }
    } catch (err) {
      console.warn('[DayGI Shares] Could not load persisted shares, starting empty:', err);
    }
  }

  private persistToDisk(): void {
    try {
      const data: SerializedShares = {
        shares: Array.from(this.shares.entries()),
        savedAt: new Date().toISOString()
      };
      fs.writeFileSync(this.filePath, JSON.stringify(data), 'utf-8');
    } catch (err) {
      console.error('[DayGI Shares] Disk persistence error:', err);
    }
  }

  public createShare(userId: string, chat: DayGiChatRecord): DayGiShareRecord {
    const record: DayGiShareRecord = {
      shareId: `SHR-${crypto.randomUUID().replace(/-/g, '')}`,
      chatId: chat.chatId,
      userId,
      title: chat.title,
      createdAt: new Date().toISOString(),
      messages: chat.messages.map(m => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp
      })),
      canvasDays: snapshotCanvas(chat.messages)
    };
    this.shares.set(record.shareId, record);
    this.persistToDisk();
    return record;
  }

  /** Public lookup: the unguessable shareId is the only credential. */
  public getShare(shareId: string): DayGiShareRecord | null {
    return this.shares.get(shareId) ?? null;
  }

  public deleteSharesForChat(userId: string, chatId: string): number {
    let removed = 0;
    for (const [shareId, record] of this.shares) {
      if (record.userId === userId && record.chatId === chatId) {
        this.shares.delete(shareId);
        removed += 1;
      }
    }
    if (removed > 0) this.persistToDisk();
    return removed;
  }
}

export const daygiShareStore = new DayGiShareStore(dataPath('daygi_shared.json'));

/** HTML-escapes snapshot content. Entities are assembled by concatenation so
 *  no tooling along the way can unescape them back into markup. */
function esc(s: string): string {
  return String(s ?? '')
    .split('&').join('&' + 'amp;')
    .split('<').join('&' + 'lt;')
    .split('>').join('&' + 'gt;')
    .split('"').join('&' + 'quot;');
}

/**
 * The public snapshot page: a frozen, dependency-free rendering of one shared
 * conversation. No scripts, no external assets, no session — anyone with the
 * link reads the same document. Only transcript text and the plan canvas are
 * included; trip health, bookings and holds never leave the private store.
 */
export function renderSharePage(share: DayGiShareRecord): string {
  const created = esc(new Date(share.createdAt).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }));
  const messages = share.messages.map(m => {
    const cls = m.sender === 'user' ? 'msg user' : 'msg daygi';
    const who = m.sender === 'user' ? 'You · أنت' : 'DayGI · دايجي';
    return `<div class="${cls}"><div class="who">${who}</div><p dir="auto">${esc(m.text)}</p></div>`;
  }).join('\n');

  const canvas = share.canvasDays.length === 0 ? '' : `
    <section class="canvas">
      <h2>Plan · الخطة</h2>
      ${share.canvasDays.map(day => `
        <div class="day">
          <h3 dir="auto">${esc(day.label)}</h3>
          ${day.title ? `<p class="daytitle" dir="auto">${esc(day.title)}</p>` : ''}
          ${day.items.map((item, index) => `
            <article class="item">
              <div class="itemhead"><span class="num">${index + 1}</span><strong dir="auto">${esc(item.name)}</strong></div>
              ${typeof item.priceEGP === 'number' && item.priceEGP > 0 ? `<div class="price">from ${item.priceEGP} EGP · ابتداءً من ${item.priceEGP} جنيه</div>` : ''}
              ${typeof item.rating === 'number' ? `<div class="rating">${item.rating.toFixed(1)} / 5${typeof item.reviewCount === 'number' ? ` (${item.reviewCount})` : ''}</div>` : ''}
              ${item.blurb ? `<p dir="auto">${esc(item.blurb)}</p>` : ''}
            </article>`).join('\n')}
        </div>`).join('\n')}
    </section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(share.title)} · DayGI shared conversation</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #0b1520; color: #e8eef4; }
  .wrap { max-width: 680px; margin: 0 auto; padding: 24px 16px 64px; }
  header { border-bottom: 1px solid #223448; padding-bottom: 16px; margin-bottom: 20px; }
  header h1 { font-size: 20px; margin: 0 0 6px; }
  header .meta { font-size: 12px; color: #8fa3b8; }
  header .note { font-size: 12px; color: #8fa3b8; margin-top: 8px; }
  .msg { border-radius: 14px; padding: 10px 14px; margin: 0 0 12px; max-width: 85%; }
  .msg .who { font-size: 11px; color: #8fa3b8; margin-bottom: 4px; }
  .msg p { margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-line; }
  .msg.user { background: #123a4a; margin-inline-start: auto; }
  .msg.daygi { background: #16283a; }
  .canvas h2 { font-size: 15px; margin: 28px 0 4px; color: #5eead4; }
  .day { margin: 14px 0 4px; }
  .day h3 { font-size: 14px; margin: 0 0 2px; }
  .daytitle { font-size: 12px; color: #8fa3b8; margin: 0 0 8px; }
  .item { background: #16283a; border: 1px solid #223448; border-radius: 12px; padding: 10px 12px; margin: 0 0 8px; }
  .itemhead { display: flex; gap: 8px; align-items: baseline; font-size: 14px; }
  .num { display: inline-flex; width: 22px; height: 22px; border-radius: 9999px; background: #1e3a4f; font-size: 11px; font-weight: 700; align-items: center; justify-content: center; flex: none; }
  .item p { margin: 6px 0 0; font-size: 13px; line-height: 1.55; color: #c6d4e2; }
  .price { font-size: 12px; font-weight: 700; margin-top: 6px; }
  .rating { font-size: 12px; color: #5eead4; margin-top: 2px; }
  footer { margin-top: 32px; font-size: 12px; color: #8fa3b8; border-top: 1px solid #223448; padding-top: 12px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1 dir="auto">${esc(share.title)}</h1>
    <div class="meta">Shared DayGI conversation · محادثة دايجي مشتركة · ${created}</div>
    <div class="note">A frozen snapshot — new messages in the live chat do not appear here. · نسخة مجمدة — الرسائل الجديدة لا تظهر هنا.</div>
  </header>
  ${messages}
  ${canvas}
  <footer>DayGI · Dahab travel platform</footer>
</div>
</body>
</html>`;
}

export function renderShareNotFound(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Link unavailable</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#0b1520;color:#e8eef4;">
<div style="max-width:560px;margin:0 auto;padding:64px 16px;text-align:center;">
<h1>Link unavailable · الرابط غير متاح</h1>
<p>This shared conversation does not exist or was removed. · هذه المحادثة غير موجودة أو تمت إزالتها.</p>
</div>
</body>
</html>`;
}

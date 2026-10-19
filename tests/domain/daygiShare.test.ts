import { describe, expect, it, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DayGiShareStore } from '../../server/services/daygiShareService';
import { DayGiChatHistoryStore } from '../../server/services/daygiChatHistoryService';
import type { DayGiChatRecord } from '../../src/shared';

/**
 * Public snapshot links: unguessable, immutable, owner-scoped for deletion,
 * and carrying transcript text plus the plan canvas only — never trip
 * health, bookings or holds.
 */

const tempDirs: string[] = [];

function tempFile(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daygi-share-'));
  tempDirs.push(dir);
  return path.join(dir, name);
}

function makeChat(chatId = 'CHAT-1'): DayGiChatRecord {
  return {
    chatId,
    userId: 'user-a',
    title: 'Plan 3 days in Dahab',
    createdAt: new Date('2026-10-12T08:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-10-12T09:30:00.000Z').toISOString(),
    messages: [
      { id: 'm1', sender: 'user', text: 'Plan 3 days', timestamp: '2026-10-12T08:00:00.000Z' },
      {
        id: 'm2',
        sender: 'daygi',
        text: 'Here is your plan.',
        timestamp: '2026-10-12T08:00:01.000Z',
        responsePayload: {
          replyText: 'Here is your plan.',
          replyTextAr: 'إليك خطتك.',
          whyThis: 'test',
          whyThisAr: 'test',
          actionType: 'MULTI_STEP_OPTIONS',
          canvas: {
            id: 'CANVAS-1',
            title: 'Options',
            titleAr: 'خيارات',
            sourcePrompt: 'q',
            createdAt: '2026-10-12T08:00:01.000Z',
            days: [
              {
                id: 'd1',
                label: 'Options',
                labelAr: 'خيارات',
                items: [
                  {
                    id: 'OPT-1',
                    name: 'Ali Baba Seafood',
                    nameAr: 'علي بابا للسمك',
                    kind: 'FOOD',
                    blurb: 'Zero delay.',
                    blurbAr: 'صفر تأخير.',
                    priceEGP: 350
                  }
                ]
              }
            ]
          }
        } as any
      }
    ]
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('DayGiShareStore', () => {
  it('mints unguessable unique ids per share', () => {
    const store = new DayGiShareStore(tempFile('shares.json'));
    const a = store.createShare('user-a', makeChat('CHAT-1'));
    const b = store.createShare('user-a', makeChat('CHAT-1'));

    expect(a.shareId).toMatch(/^SHR-[0-9a-f]{32}$/);
    expect(b.shareId).toMatch(/^SHR-[0-9a-f]{32}$/);
    expect(a.shareId).not.toBe(b.shareId);
  });

  it('snapshots transcript plus canvas, and nothing else', () => {
    const store = new DayGiShareStore(tempFile('shares.json'));
    const share = store.createShare('user-a', makeChat());

    expect(share.title).toBe('Plan 3 days in Dahab');
    expect(share.messages).toHaveLength(2);
    expect(share.messages[1].text).toBe('Here is your plan.');
    // The stored message is text-only: no payload, no health, no bookings.
    expect(share.messages[1]).not.toHaveProperty('responsePayload');
    expect(share.canvasDays).toHaveLength(1);
    expect(share.canvasDays[0].items[0].name).toBe('Ali Baba Seafood');
    expect(share.canvasDays[0].items[0].priceEGP).toBe(350);
  });

  it('resolves publicly by shareId and 404s unknown ids', () => {
    const store = new DayGiShareStore(tempFile('shares.json'));
    const share = store.createShare('user-a', makeChat());

    // A different user (or nobody at all) reads by id alone.
    expect(store.getShare(share.shareId)?.chatId).toBe('CHAT-1');
    expect(store.getShare('SHR-00000000000000000000000000000000')).toBeNull();
  });

  it('survives a restart over the same file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daygi-share-'));
    tempDirs.push(dir);
    const file = path.join(dir, 'shares.json');
    const first = new DayGiShareStore(file);
    const share = first.createShare('user-a', makeChat());

    const second = new DayGiShareStore(file);
    expect(second.getShare(share.shareId)?.title).toBe('Plan 3 days in Dahab');
  });

  it('deletes a chat’s snapshots with it', () => {
    const chatsFile = tempFile('chats.json');
    const sharesFile = tempFile('shares.json');
    const shares = new DayGiShareStore(sharesFile);
    const chats = new DayGiChatHistoryStore(chatsFile, shares);

    // Seed one chat with two turns through the real append path.
    chats.appendTurn('user-a', null, 'Plan 3 days', {
      replyText: 'Here is your plan.',
      replyTextAr: 'إليك خطتك.',
      whyThis: 'test',
      whyThisAr: 'test',
      actionType: 'RECOMMENDATION'
    } as any);
    const chatId = chats.listChats('user-a')[0].chatId;
    const chat = chats.getChat('user-a', chatId)!;
    const share = shares.createShare('user-a', chat);

    expect(chats.deleteChat('user-a', chatId)).toBe(true);
    expect(shares.getShare(share.shareId)).toBeNull();
  });
});

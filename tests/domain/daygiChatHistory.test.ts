import { describe, expect, it, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DayGiChatHistoryStore } from '../../server/services/daygiChatHistoryService';
import type { DayGiResponse } from '../../src/shared';

/**
 * Saved conversations must be complete (every query turn recorded), private
 * (a chatId that belongs to someone else resolves to nothing and never
 * receives writes), and durable (a new store instance over the same file
 * restores the same history, like a server restart).
 */

function makeResponse(reply: string): DayGiResponse {
  return {
    replyText: reply,
    replyTextAr: reply,
    whyThis: 'test',
    whyThisAr: 'test',
    actionType: 'RECOMMENDATION',
    actionRisk: 'READ_ONLY'
  };
}

const tempDirs: string[] = [];

function makeStore(): DayGiChatHistoryStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daygi-chats-'));
  tempDirs.push(dir);
  return new DayGiChatHistoryStore(path.join(dir, 'daygi_chats.json'));
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('DayGiChatHistoryStore', () => {
  it('starts a new chat when no chatId is given, titled from the prompt', () => {
    const store = makeStore();
    const turn = store.appendTurn('user-a', null, 'Plan 3 days in Dahab', makeResponse('Here is your plan.'));

    expect(turn.created).toBe(true);
    const chat = store.getChat('user-a', turn.chatId);
    expect(chat).not.toBeNull();
    expect(chat!.title).toBe('Plan 3 days in Dahab');
    expect(chat!.messages).toHaveLength(2);
    expect(chat!.messages[0].sender).toBe('user');
    expect(chat!.messages[0].text).toBe('Plan 3 days in Dahab');
    expect(chat!.messages[1].sender).toBe('daygi');
    expect(chat!.messages[1].text).toBe('Here is your plan.');
  });

  it('keeps appending to the same chat via the returned chatId', () => {
    const store = makeStore();
    const first = store.appendTurn('user-a', null, 'question one', makeResponse('answer one'));
    const second = store.appendTurn('user-a', first.chatId, 'question two', makeResponse('answer two'));

    expect(second.created).toBe(false);
    expect(second.chatId).toBe(first.chatId);
    const chat = store.getChat('user-a', first.chatId)!;
    expect(chat.messages).toHaveLength(4);
    expect(chat.messages[2].text).toBe('question two');
  });

  it('preserves the response payload for card rendering on resume', () => {
    const store = makeStore();
    const response = makeResponse('answer');
    response.actionTitle = 'Options';
    const turn = store.appendTurn('user-a', null, 'q', response);
    expect(store.getChat('user-a', turn.chatId)!.messages[1].responsePayload?.actionTitle).toBe('Options');
  });

  it('never lets one user read, delete or append into another user\'s chat', () => {
    const store = makeStore();
    const owner = store.appendTurn('user-a', null, 'private question', makeResponse('private answer'));

    expect(store.getChat('user-b', owner.chatId)).toBeNull();
    expect(store.deleteChat('user-b', owner.chatId)).toBe(false);
    // A foreign chatId must start a NEW chat for user-b, not touch user-a's.
    const foreign = store.appendTurn('user-b', owner.chatId, 'intrusion', makeResponse('reply'));
    expect(foreign.created).toBe(true);
    expect(foreign.chatId).not.toBe(owner.chatId);
    expect(store.getChat('user-a', owner.chatId)!.messages).toHaveLength(2);
  });

  it('lists summaries newest-first with message counts', async () => {
    const store = makeStore();
    const a = store.appendTurn('user-a', null, 'first chat', makeResponse('a'));
    await new Promise(resolve => setTimeout(resolve, 5));
    const b = store.appendTurn('user-a', null, 'second chat', makeResponse('b'));
    await new Promise(resolve => setTimeout(resolve, 5));
    // Touch the first chat so its updatedAt moves past the second's.
    store.appendTurn('user-a', a.chatId, 'again', makeResponse('again'));

    const list = store.listChats('user-a');
    expect(list).toHaveLength(2);
    expect(list[0].chatId).toBe(a.chatId);
    expect(list[0].messageCount).toBe(4);
    expect(list[1].chatId).toBe(b.chatId);
    expect(list[1].messageCount).toBe(2);
  });

  it('deletes a chat and keeps the rest', () => {
    const store = makeStore();
    const a = store.appendTurn('user-a', null, 'one', makeResponse('1'));
    const b = store.appendTurn('user-a', null, 'two', makeResponse('2'));

    expect(store.deleteChat('user-a', a.chatId)).toBe(true);
    expect(store.getChat('user-a', a.chatId)).toBeNull();
    expect(store.getChat('user-a', b.chatId)).not.toBeNull();
  });

  it('survives a restart: a new store over the same file restores history', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daygi-chats-'));
    tempDirs.push(dir);
    const file = path.join(dir, 'daygi_chats.json');
    const first = new DayGiChatHistoryStore(file);
    const turn = first.appendTurn('user-a', null, 'durable question', makeResponse('durable answer'));

    const second = new DayGiChatHistoryStore(file);
    const restored = second.getChat('user-a', turn.chatId);
    expect(restored).not.toBeNull();
    expect(restored!.title).toBe('durable question');
    expect(restored!.messages[1].text).toBe('durable answer');
    expect(second.listChats('user-a')).toHaveLength(1);
  });

  it('marks summaries with a plan canvas for the history filter', () => {
    const store = makeStore();
    const withCanvas = makeResponse('plan answer');
    withCanvas.actionTitle = 'Options';
    withCanvas.canvas = {
      id: 'CANVAS-1',
      title: 'Options',
      titleAr: 'خيارات',
      sourcePrompt: 'q',
      days: [],
      createdAt: new Date().toISOString()
    };
    store.appendTurn('user-a', null, 'plan question', withCanvas);
    store.appendTurn('user-a', null, 'plain question', makeResponse('plain answer'));

    const list = store.listChats('user-a');
    expect(list).toHaveLength(2);
    const planChat = list.find(c => c.title === 'plan question')!;
    const plainChat = list.find(c => c.title === 'plain question')!;
    expect(planChat.hasPlan).toBe(true);
    expect(plainChat.hasPlan).toBe(false);
  });

  it('clamps oversized titles and message text', () => {
    const store = makeStore();
    const longPrompt = 'x'.repeat(300);
    const turn = store.appendTurn('user-a', null, longPrompt, makeResponse('y'.repeat(9000)));

    const chat = store.getChat('user-a', turn.chatId)!;
    expect(chat.title.length).toBeLessThanOrEqual(71);
    expect(chat.title.endsWith('…')).toBe(true);
    expect(chat.messages[1].text.length).toBeLessThanOrEqual(8001);
  });

  it('caps the per-user chat list, dropping the oldest', () => {
    const store = makeStore();
    let oldestId = '';
    for (let i = 0; i < 32; i++) {
      const turn = store.appendTurn('user-a', null, `chat ${i}`, makeResponse('r'));
      if (i === 0) oldestId = turn.chatId;
    }
    const list = store.listChats('user-a');
    expect(list.length).toBeLessThanOrEqual(30);
    expect(list.some(c => c.chatId === oldestId)).toBe(false);
  });
});

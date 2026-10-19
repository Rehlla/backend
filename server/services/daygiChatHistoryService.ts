import fs from 'fs';
import { dataPath } from '../db/paths';
import { daygiShareStore } from './daygiShareService';
import type {
  DayGiResponse,
  DayGiChatRecord,
  DayGiChatSummary,
  DayGiStoredChatMessage
} from '../../src/shared';

/**
 * Saved DayGI conversations ("All chats").
 *
 * TripAdvisor-style assistants keep a chat list: every exchange is stored, can
 * be listed, resumed and deleted. Here the capture point is the query handler
 * — after the deterministic (or polished) response exists, the user prompt and
 * the assistant reply are appended to the session user's chat, so history is
 * complete without any client cooperation beyond carrying `chatId` back.
 *
 * Storage mirrors the orchestrator: one JSON file under the writable data dir,
 * written synchronously after each mutation, loaded at boot. All reads and
 * writes are keyed by the session user id — a foreign chatId simply does not
 * resolve, which is the ownership check.
 */

const MAX_CHATS_PER_USER = 30;
const MAX_MESSAGES_PER_CHAT = 100;
const MAX_MESSAGE_CHARS = 8000;
const MAX_TITLE_CHARS = 70;

function clampText(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

interface SerializedStore {
  chats: Array<[string, Array<DayGiChatRecord>]>;
  savedAt: string;
}

export class DayGiChatHistoryStore {
  private byUser = new Map<string, Map<string, DayGiChatRecord>>();
  private seq = 0;

  /**
   * @param shareStore kept injectable so tests can point history AND shares
   * at throwaway files; production uses the shared singleton.
   */
  constructor(
    private readonly filePath: string,
    private readonly shareStore?: { deleteSharesForChat(userId: string, chatId: string): number }
  ) {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as SerializedStore;
      if (!Array.isArray(parsed.chats)) return;
      for (const [userId, chats] of parsed.chats) {
        if (!Array.isArray(chats)) continue;
        this.byUser.set(userId, new Map(chats.map(chat => [chat.chatId, chat])));
      }
      if (this.byUser.size > 0) {
        console.log(`[DayGI Chats] Restored conversations for ${this.byUser.size} user(s) from disk.`);
      }
    } catch (err) {
      console.warn('[DayGI Chats] Could not load persisted chats, starting empty:', err);
    }
  }

  private persistToDisk(): void {
    try {
      const data: SerializedStore = {
        chats: Array.from(this.byUser.entries()).map(([userId, chats]) => [userId, Array.from(chats.values())]),
        savedAt: new Date().toISOString()
      };
      fs.writeFileSync(this.filePath, JSON.stringify(data), 'utf-8');
    } catch (err) {
      console.error('[DayGI Chats] Disk persistence error:', err);
    }
  }

  /**
   * Records one exchange. A null, unknown or foreign chatId starts a new chat;
   * the returned chatId is what the client sends back on its next turn.
   */
  public appendTurn(
    userId: string,
    chatId: string | null | undefined,
    prompt: string,
    response: DayGiResponse
  ): { chatId: string; created: boolean } {
    const now = new Date().toISOString();
    const chats = this.byUser.get(userId) ?? new Map<string, DayGiChatRecord>();
    let created = false;
    let chat = chatId ? chats.get(chatId) : undefined;
    if (!chat) {
      created = true;
      chat = {
        chatId: `CHAT-${Date.now().toString(36)}-${(this.seq += 1)}`,
        userId,
        title: clampText(prompt, MAX_TITLE_CHARS),
        createdAt: now,
        updatedAt: now,
        messages: []
      };
      chats.set(chat.chatId, chat);
      this.byUser.set(userId, chats);
      this.enforceChatCap(userId, chats);
    }

    const userMessage: DayGiStoredChatMessage = {
      id: `msg-user-${now}`,
      sender: 'user',
      text: clampText(prompt, MAX_MESSAGE_CHARS),
      timestamp: now
    };
    const daygiMessage: DayGiStoredChatMessage = {
      id: `msg-daygi-${now}`,
      sender: 'daygi',
      text: clampText(response.replyText || response.replyTextAr || '', MAX_MESSAGE_CHARS),
      timestamp: now,
      responsePayload: response
    };
    chat.messages.push(userMessage, daygiMessage);
    if (chat.messages.length > MAX_MESSAGES_PER_CHAT) {
      chat.messages = chat.messages.slice(chat.messages.length - MAX_MESSAGES_PER_CHAT);
    }
    chat.updatedAt = now;
    this.persistToDisk();
    return { chatId: chat.chatId, created };
  }

  public listChats(userId: string): DayGiChatSummary[] {
    const chats = this.byUser.get(userId);
    if (!chats) return [];
    return Array.from(chats.values())
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .map(chat => ({
        chatId: chat.chatId,
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        messageCount: chat.messages.length,
        hasPlan: chat.messages.some(m => m.responsePayload?.canvas !== undefined)
      }));
  }

  /** Ownership is implicit: the record lives under the requesting user's key. */
  public getChat(userId: string, chatId: string): DayGiChatRecord | null {
    return this.byUser.get(userId)?.get(chatId) ?? null;
  }

  public deleteChat(userId: string, chatId: string): boolean {
    const chats = this.byUser.get(userId);
    if (!chats || !chats.has(chatId)) return false;
    chats.delete(chatId);
    if (chats.size === 0) this.byUser.delete(userId);
    // A deleted conversation takes its public snapshots with it: a share
    // link must never outlive the chat it froze.
    try {
      this.shareStore?.deleteSharesForChat(userId, chatId);
    } catch (err) {
      console.warn('[DayGI Chats] Failed to cascade share deletion:', err);
    }
    this.persistToDisk();
    return true;
  }

  private enforceChatCap(userId: string, chats: Map<string, DayGiChatRecord>): void {
    if (chats.size <= MAX_CHATS_PER_USER) return;
    const oldest = Array.from(chats.values())
      .sort((a, b) => (a.updatedAt < b.updatedAt ? -1 : 1))
      .slice(0, chats.size - MAX_CHATS_PER_USER);
    for (const chat of oldest) {
      chats.delete(chat.chatId);
    }
  }
}

export const daygiChatHistory = new DayGiChatHistoryStore(dataPath('daygi_chats.json'), daygiShareStore);

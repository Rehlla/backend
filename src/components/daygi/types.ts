import { DayGiResponse } from '../../types';

/**
 * Chat message type for DayGI conversation.
 * Extracted from DayGiConciergeView to reduce file size and enable reuse.
 */
export interface ChatMessage {
  id: string;
  sender: 'user' | 'daygi';
  text: string;
  timestamp: string;
  responsePayload?: DayGiResponse;
  liked?: boolean;
  disliked?: boolean;
  actionExecuted?: boolean;
  executionResult?: any;
  /**
   * Where the traveler was in the app when they sent this — rendered under
   * the traveler's bubble ("Asked while viewing My Trip"). A display label
   * resolved at send time, never a route object.
   */
  askedWhileViewing?: string;
}
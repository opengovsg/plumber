import type { AIBuilderDraftState } from './AiBuilderContext'

// The assistant wraps a suggested continuation prompt in a <code> block; "New Chat"
// pre-fills the input with it so the user can carry the idea into the new conversation.
const CONTINUATION_PROMPT_REGEX = /<code[^>]*>([\s\S]*?)<\/code>/

/**
 * Extract the continuation prompt from an assistant message's <code> block, if present.
 */
export const extractContinuationPrompt = (lastMessageText?: string): string => {
  const match = lastMessageText?.match(CONTINUATION_PROMPT_REGEX)
  return match ? match[1].trim() : ''
}

/**
 * Build the draft state for a brand-new chat. Always mints a fresh chatId so the new
 * chat starts a new Langfuse session — never carrying the previous chat's id forward.
 *
 * Also doubles as the default draft for a fresh mount with nothing usable in
 * sessionStorage (first-ever visit, or a session that expired): called with no
 * argument, `extractContinuationPrompt` returns `''`, giving the same empty draft.
 */
export const createNewChatDraft = (
  lastMessageText?: string,
): AIBuilderDraftState => ({
  flowName: 'Build with AI',
  chatInput: extractContinuationPrompt(lastMessageText),
  chatMessages: [],
  output: { trigger: '', actions: '', name: 'Build with AI', traceId: '' },
  chatId: crypto.randomUUID(),
})

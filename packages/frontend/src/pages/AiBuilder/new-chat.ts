import type { AIBuilderDraftState } from './AiBuilderContext'

// The assistant wraps a suggested continuation prompt in a <code> block; "New Chat"
// pre-fills the input with it so the user can carry the idea into the new conversation.
const CONTINUATION_PROMPT_REGEX = /<code[^>]*>([\s\S]*?)<\/code>/

export const CONTINUE_PIPE_PROMPT = 'Continue building my pipe.'

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

/**
 * Builds a new chat that keeps the current pipe.
 *
 * Used when the old chat grew too large to send. No summary turn can run then, so the pipe carries the progress.
 * The new chat's first request resends the pipe's step ids (see useChatStream).
 */
export const createNewChatDraftKeepingPipe = (
  previous: Pick<
    AIBuilderDraftState,
    'flowName' | 'output' | 'parameterLabelsByStepId'
  >,
): AIBuilderDraftState => {
  if (!previous.output?.pipeId) {
    return createNewChatDraft()
  }
  return {
    ...createNewChatDraft(),
    flowName: previous.flowName,
    chatInput: CONTINUE_PIPE_PROMPT,
    output: previous.output,
    parameterLabelsByStepId: previous.parameterLabelsByStepId,
  }
}

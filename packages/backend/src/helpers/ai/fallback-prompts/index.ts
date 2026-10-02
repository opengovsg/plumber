import { FALLBACK_CHAT_PROMPT } from './chat'
import { FALLBACK_CHAT_SUMMARY_PROMPT } from './chat-summary'

/**
 * Static last-resort prompts keyed by Langfuse prompt name.
 * Covers LD defaults from AI_BUILDER_FEATURE_FLAG_FALLBACK.
 */
const STATIC_PROMPT_FALLBACKS: Record<string, string> = {
  chat: FALLBACK_CHAT_PROMPT,
  'chat-summary': FALLBACK_CHAT_SUMMARY_PROMPT,
}

export function getStaticPromptFallback(
  promptName: string,
): string | undefined {
  return STATIC_PROMPT_FALLBACKS[promptName]
}

import type { SystemModelMessage } from 'ai'

import {
  buildSupportFormUrl,
  SUPPORT_FORM_URL_PLACEHOLDER,
} from '@/helpers/ai/build-support-form-url'
import { buildSystemPrompt } from '@/helpers/build-system-prompt'

import { CACHE_CONTROL_PROVIDER_OPTIONS } from './cache-breakpoints'
import {
  buildEstablishedConnectionReminder,
  type EstablishedFormConnection,
} from './helpers'

// IMPORTANT: must not vary by chat, or chats stop sharing the system prompt cache.
const SUPPORT_FORM_URL_INSTRUCTION = `When you link the support form, write ${SUPPORT_FORM_URL_PLACEHOLDER} or the support form URL from the chat context below.`

interface BuildChatSystemMessagesOptions {
  basePrompt: string
  restrictedApps: string[]
  chatId: string | undefined
  establishedFormConnection: EstablishedFormConnection | null
}

/**
 * Splits the system prompt at the cache checkpoint.
 *
 * The first message is shared by every chat with the same permissions, so Bedrock reuses its cache across chats.
 */
export function buildChatSystemMessages({
  basePrompt,
  restrictedApps,
  chatId,
  establishedFormConnection,
}: BuildChatSystemMessagesOptions): [SystemModelMessage, SystemModelMessage] {
  const chatContext = [
    'Chat context:',
    `Support form URL for this chat: ${buildSupportFormUrl(chatId)}`,
    buildEstablishedConnectionReminder(establishedFormConnection).trim(),
  ]
    .filter(Boolean)
    .join('\n\n')

  return [
    {
      role: 'system',
      content: `${buildSystemPrompt(basePrompt, restrictedApps)}\n\n${SUPPORT_FORM_URL_INSTRUCTION}`,
      providerOptions: CACHE_CONTROL_PROVIDER_OPTIONS,
    },
    { role: 'system', content: chatContext },
  ]
}

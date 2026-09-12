import { createOpenAI } from '@ai-sdk/openai'

import appConfig from '@/config/app'

import { wrapFetchWithPromptCache } from './pair-prompt-cache'

const MODEL_TYPE = appConfig.pair.foundry.model

const pairOpenAISettings = {
  name: 'pair-engine',
  baseURL: 'https://engine.pair.gov.sg',
  apiKey: appConfig.pair.foundry.apiKey,
} as const

const engineProvider = createOpenAI(pairOpenAISettings)
const model = engineProvider.chat(MODEL_TYPE)

/**
 * AI Builder sends a large stable system prompt and tool list across turns.
 * PAIR pipe actions do not, so they use `model` / `engineProvider` instead.
 */
const chatModel = createOpenAI({
  ...pairOpenAISettings,
  fetch: wrapFetchWithPromptCache(),
}).chat(MODEL_TYPE)

export { chatModel, engineProvider, model, MODEL_TYPE }

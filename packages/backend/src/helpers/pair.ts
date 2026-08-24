import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModelV2 } from '@ai-sdk/provider'

import appConfig from '@/config/app'

const MODEL_TYPE = appConfig.pair.foundry.model
const engineProvider = createOpenAI({
  name: 'pair-engine',
  baseURL: 'https://engine.pair.gov.sg',
  apiKey: appConfig.pair.foundry.apiKey,
})
const model: LanguageModelV2 = engineProvider.chat(MODEL_TYPE)

export { engineProvider, model, MODEL_TYPE }

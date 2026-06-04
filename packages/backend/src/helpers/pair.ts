import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

import appConfig from '@/config/app'

export const MODEL_TYPE = appConfig.pair.foundry.model
const engineProvider = createOpenAICompatible({
  name: 'pair-engine',
  baseURL: 'https://engine.pair.gov.sg',
  apiKey: appConfig.pair.foundry.apiKey,
  supportsStructuredOutputs: true,
  includeUsage: true,
})
const model = engineProvider.chatModel(MODEL_TYPE)

export { engineProvider, model }

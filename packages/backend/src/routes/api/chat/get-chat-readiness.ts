import { generateObject } from 'ai'

import appConfig from '@/config/app'
import { getPrompt } from '@/helpers/ai/get-prompt'
import { engineProvider } from '@/helpers/pair'
import Context from '@/types/express/context'

import { isChatReadySchema } from './schema'

interface isChatReadyInput {
  context: Context
  promptName: string
  promptVersion: string
  llmResponse: string
  sessionId: string
  modelId: string
}

const getChatReadiness = async (input: isChatReadyInput): Promise<boolean> => {
  const {
    context,
    promptName,
    promptVersion,
    llmResponse,
    sessionId,
    modelId,
  } = input

  const chatReadinessModel = engineProvider.chat(modelId)

  const chatReadinessPrompt = await getPrompt(promptName, promptVersion)

  // Generate step status using a fast structured call
  const { object } = await generateObject({
    model: chatReadinessModel,
    schema: isChatReadySchema,
    system: chatReadinessPrompt.prompt,
    prompt: llmResponse,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'is-chat-ready',
      metadata: {
        name: 'is-chat-ready',
        sessionId: sessionId || 'unknown',
        userId: context.currentUser.email,
        environment: appConfig.appEnv,
        promptName,
        promptVersion,
        langfusePrompt: chatReadinessPrompt.toJSON(),
        tags: ['ai-builder', 'chat-readiness'],
      },
    },
  })

  return object.isReady
}

export { getChatReadiness }

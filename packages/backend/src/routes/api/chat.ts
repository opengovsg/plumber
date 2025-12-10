import { startActiveObservation } from '@langfuse/tracing'
import { convertToModelMessages, smoothStream, streamText } from 'ai'
import type { Request, Response } from 'express'
import { Router } from 'express'

import appConfig from '@/config/app'
import { langfuseClient } from '@/helpers/langfuse'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import logger from '@/helpers/logger'
import { model, MODEL_TYPE } from '@/helpers/pair'

import { getAuthenticatedContext } from './middleware/authentication'

interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    parts: Array<{ type: 'text'; text: string }>
  }>
  userId?: string
  sessionId?: string
}

async function handleChatStream(req: Request, res: Response) {
  const context = getAuthenticatedContext(req)

  const promptConfig = await getLdFlagValue(
    'ai-builder-prompt-config',
    context.currentUser.email,
    {
      chatPrompt: 'ai-builder/chat',
      version: 'production',
    },
  )

  const { chatPrompt, version } = promptConfig

  try {
    const { messages: rawMessages, sessionId } = req.body as ChatRequest

    if (
      !rawMessages ||
      !Array.isArray(rawMessages) ||
      rawMessages.length === 0
    ) {
      res.status(400).json({ error: 'Messages array is required' })
      return
    }

    // Convert UIMessages to ModelMessages
    const messages = convertToModelMessages(rawMessages as any)

    // Extract last user message text for tracking (simple text-only format)
    const lastUserMessage = rawMessages
      .filter((m) => m.role === 'user')
      .map((m) => m.parts.find((p) => p.type === 'text')?.text || '')
      .pop()

    // Get the prompt from Langfuse
    const prompt = await langfuseClient.prompt.get(chatPrompt, {
      label: version,
    })

    let traceId = ''

    // Setup observation and stream using AI SDK
    const result = await startActiveObservation(
      'ai-chat-stream',
      async (trace) => {
        trace.updateTrace({
          name: 'ai-chat-stream',
          sessionId: sessionId || 'unknown',
          userId: context.currentUser.email || 'anonymous',
          input: { messages, prompt: lastUserMessage },
          tags: ['ai-builder', 'chat', 'stream'],
          environment: appConfig.appEnv,
        })

        const generation = trace.startObservation(
          'ai-stream-generation',
          {
            model: MODEL_TYPE,
            input: [{ role: 'system', content: prompt.prompt }, ...messages],
          },
          { asType: 'generation' },
        )

        generation.update({
          prompt,
        })

        // Capture IDs for client
        traceId = trace.traceId

        return streamText({
          model,
          messages: [{ role: 'system', content: prompt.prompt }, ...messages],
          experimental_transform: smoothStream({
            chunking: 'word', // Stream word-by-word for typing effect
          }),
          experimental_telemetry: {
            isEnabled: true,
          },
          onFinish: (event) => {
            logger.info('Stream finished', {
              traceId,
              textLength: event.text.length,
            })

            trace.update({
              output: { result: event.text },
              level: 'DEFAULT',
            })

            generation
              .update({
                output: event.text,
                usageDetails: {
                  input: event.usage.inputTokens,
                  output: event.usage.outputTokens,
                  total: event.usage.totalTokens,
                },
              })
              .end()
          },
          onError: (error) => {
            const errorMessage =
              error instanceof Error ? error.message : String(error)

            logger.error('Error generating chat response', {
              traceId,
              error: errorMessage,
            })

            trace.update({
              output: { error: errorMessage },
              level: 'ERROR',
            })

            generation
              .update({
                output: errorMessage,
                level: 'ERROR',
              })
              .end()
          },
        })
      },
    )

    // Pipe the UI message stream to Express response
    // This uses the data stream protocol that DefaultChatTransport expects
    result.pipeUIMessageStreamToResponse(res, {
      messageMetadata: () => {
        return {
          traceId,
          model: MODEL_TYPE,
        }
      },
    })
  } catch (error) {
    logger.error('Error in chat stream', { error })

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'

    // If headers haven't been sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({ error: errorMessage })
    } else {
      res.end()
    }
  }
}

const router = Router()

router.post('/', handleChatStream)

export default router

import { getStaticPromptFallback } from '@/helpers/ai/fallback-prompts'
import {
  readCachedPrompt,
  writeCachedPrompt,
} from '@/helpers/ai/get-prompt-cache'
import { getLangfuseClient, type LangfuseProject } from '@/helpers/langfuse'
import logger from '@/helpers/logger'

export type PromptSource = 'langfuse' | 'redis' | 'static'

type PromptClientLike = {
  prompt: string
  toJSON: () => string
}

const DEFAULT_PROMPT_LABEL = 'production'

function createFallbackPrompt(
  promptName: string,
  promptText: string,
  source: Exclude<PromptSource, 'langfuse'>,
  label: string,
): PromptClientLike {
  return {
    prompt: promptText,
    toJSON: () =>
      JSON.stringify({
        name: promptName,
        version: 0,
        label,
        source,
        isFallback: true,
        type: 'text',
        prompt: promptText,
      }),
  }
}

function extractPromptText(prompt: { prompt: unknown }): string | null {
  return typeof prompt.prompt === 'string' && prompt.prompt.length > 0
    ? prompt.prompt
    : null
}

/**
 * Fetches an AI Builder prompt from Rome (Langfuse), with Redis then static
 * fallbacks so chat stays usable when Rome is down.
 */
export const getPrompt = async (
  promptName: string,
  project: LangfuseProject,
  version?: string,
): Promise<PromptClientLike> => {
  const label = version ?? DEFAULT_PROMPT_LABEL
  const client = getLangfuseClient(project)

  try {
    const prompt = await client.prompt.get(
      promptName,
      version ? { label: version } : undefined,
    )

    const promptText = extractPromptText(prompt)
    if (promptText) {
      // Best-effort cache: do not delay the live Rome response on Redis.
      void writeCachedPrompt(project, promptName, label, promptText)
    }

    logger.info('Loaded Langfuse prompt', {
      event: 'langfuse-prompt-loaded',
      source: 'langfuse' satisfies PromptSource,
      promptName,
      project,
      label,
    })

    return prompt
  } catch (error) {
    logger.error('Failed to fetch Langfuse prompt; trying fallbacks', {
      event: 'langfuse-prompt-fetch-error',
      promptName,
      project,
      label,
      error: error instanceof Error ? error.message : String(error),
    })

    const cachedPromptText = await readCachedPrompt(project, promptName, label)
    if (cachedPromptText) {
      logger.warn('Using Redis-cached Langfuse prompt', {
        event: 'langfuse-prompt-fallback',
        source: 'redis' satisfies PromptSource,
        promptName,
        project,
        label,
      })
      return createFallbackPrompt(promptName, cachedPromptText, 'redis', label)
    }

    const staticPromptText = getStaticPromptFallback(promptName)
    if (staticPromptText) {
      logger.warn('Using static Langfuse prompt fallback', {
        event: 'langfuse-prompt-fallback',
        source: 'static' satisfies PromptSource,
        promptName,
        project,
        label,
      })
      return createFallbackPrompt(promptName, staticPromptText, 'static', label)
    }

    throw error
  }
}

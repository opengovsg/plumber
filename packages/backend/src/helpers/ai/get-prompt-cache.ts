import type { LangfuseProject } from '@/helpers/langfuse'
import logger from '@/helpers/logger'
import { redisAppDataClient } from '@/helpers/redis-app-data'

/** Keep stale prompts long enough to survive multi-day Rome outages. */
export const PROMPT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30

const PROMPT_CACHE_KEY_PREFIX = 'langfuse-prompt'

type CachedPrompt = {
  promptText: string
  cachedAt: string
}

export function makePromptCacheKey(
  project: LangfuseProject,
  promptName: string,
  label: string,
): string {
  return `${PROMPT_CACHE_KEY_PREFIX}:${project}:${promptName}:${label}`
}

export async function readCachedPrompt(
  project: LangfuseProject,
  promptName: string,
  label: string,
): Promise<string | null> {
  const redisKey = makePromptCacheKey(project, promptName, label)
  try {
    const raw = await redisAppDataClient.get(redisKey)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as CachedPrompt
    if (typeof parsed.promptText !== 'string' || !parsed.promptText) {
      return null
    }

    return parsed.promptText
  } catch (error) {
    logger.warn('Failed to read Langfuse prompt cache', {
      event: 'langfuse-prompt-cache-read-error',
      redisKey,
      promptName,
      project,
      label,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function writeCachedPrompt(
  project: LangfuseProject,
  promptName: string,
  label: string,
  promptText: string,
): Promise<void> {
  const redisKey = makePromptCacheKey(project, promptName, label)
  const payload: CachedPrompt = {
    promptText,
    cachedAt: new Date().toISOString(),
  }

  try {
    await redisAppDataClient.set(
      redisKey,
      JSON.stringify(payload),
      'EX',
      PROMPT_CACHE_TTL_SECONDS,
    )
  } catch (error) {
    // Live Rome fetch already succeeded; cache write must not fail the request.
    logger.warn('Failed to write Langfuse prompt cache', {
      event: 'langfuse-prompt-cache-write-error',
      redisKey,
      promptName,
      project,
      label,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

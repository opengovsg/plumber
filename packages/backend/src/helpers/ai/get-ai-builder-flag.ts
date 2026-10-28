import { z } from 'zod'

import {
  AI_BUILDER_FEATURE_FLAG,
  AI_BUILDER_FEATURE_FLAG_FALLBACK,
} from '@/config/flags'

export type AiBuilderLdFlagValue = typeof AI_BUILDER_FEATURE_FLAG_FALLBACK

const gitbookServerSchema = z.object({
  gitbook: z.boolean(),
})

/**
 * Existing flag variations omit mcpServers, so a missing or invalid value stays available.
 */
function gitbookAvailable(mcpServers: unknown): boolean {
  const parsed = gitbookServerSchema.safeParse(mcpServers)
  if (!parsed.success) {
    return true
  }
  return parsed.data.gitbook
}

/**
 * Resolves the ai-builder flag from a full LD flag map (e.g. `allFlagsState`),
 * merging with {@link AI_BUILDER_FEATURE_FLAG_FALLBACK} when absent or invalid.
 */
export function getAiBuilderFlag(
  allLdFlags: Record<string, unknown>,
): AiBuilderLdFlagValue {
  const flagValue = allLdFlags[AI_BUILDER_FEATURE_FLAG]
  if (!flagValue) {
    return AI_BUILDER_FEATURE_FLAG_FALLBACK
  }

  const flag = flagValue as AiBuilderLdFlagValue
  if (typeof flag.config !== 'object' || flag.config === null) {
    return flag
  }

  return {
    ...flag,
    config: {
      ...flag.config,
      mcpServers: {
        gitbook: gitbookAvailable(flag.config.mcpServers),
      },
    },
  }
}

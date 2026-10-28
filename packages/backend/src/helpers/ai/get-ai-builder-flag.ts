import { z } from 'zod'

import {
  AI_BUILDER_FEATURE_FLAG,
  AI_BUILDER_FEATURE_FLAG_FALLBACK,
} from '@/config/flags'

export type AiBuilderLdFlagValue = typeof AI_BUILDER_FEATURE_FLAG_FALLBACK

const disabledMcpServersSchema = z.array(z.string().min(1))

/** A malformed list stays empty so a bad edit cannot take a server offline. */
function readDisabledMcpServers(value: unknown): string[] {
  const parsed = disabledMcpServersSchema.safeParse(value)
  if (!parsed.success) {
    return []
  }
  return [...new Set(parsed.data)].sort()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Resolves the ai-builder flag from a full LD flag map (e.g. `allFlagsState`),
 * merging with {@link AI_BUILDER_FEATURE_FLAG_FALLBACK} when absent or invalid.
 */
export function getAiBuilderFlag(
  allLdFlags: Record<string, unknown>,
): AiBuilderLdFlagValue {
  const flagValue = allLdFlags[AI_BUILDER_FEATURE_FLAG]
  if (!isRecord(flagValue) || !isRecord(flagValue.config)) {
    return AI_BUILDER_FEATURE_FLAG_FALLBACK
  }

  const { disabledMcpServers: rawDisabledMcpServers, ...config } =
    flagValue.config

  return {
    ...flagValue,
    config: {
      ...config,
      disabledMcpServers: readDisabledMcpServers(rawDisabledMcpServers),
    },
  } as AiBuilderLdFlagValue
}

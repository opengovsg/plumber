import { z } from 'zod'

import {
  AI_BUILDER_FEATURE_FLAG,
  AI_BUILDER_FEATURE_FLAG_FALLBACK,
} from '@/config/flags'

export type AiBuilderMcpServers = {
  gitbook: boolean
  [server: string]: boolean
}

export type AiBuilderLdFlagValue = Omit<
  typeof AI_BUILDER_FEATURE_FLAG_FALLBACK,
  'config'
> & {
  config: Omit<
    (typeof AI_BUILDER_FEATURE_FLAG_FALLBACK)['config'],
    'mcpServers'
  > & {
    mcpServers: AiBuilderMcpServers
  }
}

const mcpServerSchema = z.boolean()

/**
 * Existing flag variations omit server keys. A missing or non-boolean value stays available.
 */
function mcpServerAvailable(value: unknown): boolean {
  const parsed = mcpServerSchema.safeParse(value)
  if (!parsed.success) {
    return true
  }
  return parsed.data
}

function readMcpServers(mcpServers: unknown): AiBuilderMcpServers {
  const servers: AiBuilderMcpServers = { gitbook: true }
  if (
    typeof mcpServers !== 'object' ||
    mcpServers === null ||
    Array.isArray(mcpServers)
  ) {
    return servers
  }

  for (const [server, value] of Object.entries(mcpServers)) {
    servers[server] = mcpServerAvailable(value)
  }
  return servers
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
      mcpServers: readMcpServers(flag.config.mcpServers),
    },
  }
}

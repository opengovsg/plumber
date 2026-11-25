import { z } from 'zod'

import {
  AI_BUILDER_FEATURE_FLAG,
  AI_BUILDER_FEATURE_FLAG_FALLBACK,
  MCP_SERVER_NAMES,
  type McpServerName,
} from '@/config/flags'
import logger from '@/helpers/logger'

export type AiBuilderLdFlagValue = typeof AI_BUILDER_FEATURE_FLAG_FALLBACK

const mcpServerNameSchema = z.enum(MCP_SERVER_NAMES)

function readDisabledMcpServers(value: unknown): McpServerName[] {
  // Existing variations omit the list. A missing list is not a bad edit.
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    logger.warn('Rejected disabledMcpServers value', {
      disabledMcpServers: value,
    })
    return []
  }

  const accepted: McpServerName[] = []
  const rejected: unknown[] = []
  for (const entry of value) {
    const parsed = mcpServerNameSchema.safeParse(entry)
    if (!parsed.success) {
      rejected.push(entry)
      continue
    }
    accepted.push(parsed.data)
  }
  if (rejected.length > 0) {
    logger.warn('Rejected disabledMcpServers entries', { rejected })
  }
  return [...new Set(accepted)].sort()
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

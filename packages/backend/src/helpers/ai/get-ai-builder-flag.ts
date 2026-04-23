import {
  AI_BUILDER_FEATURE_FLAG,
  AI_BUILDER_FEATURE_FLAG_FALLBACK,
} from '@/config/flags'

export type AiBuilderLdFlagValue = typeof AI_BUILDER_FEATURE_FLAG_FALLBACK

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

  return flagValue as AiBuilderLdFlagValue
}

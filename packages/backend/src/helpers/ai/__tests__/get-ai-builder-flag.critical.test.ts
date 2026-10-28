/**
 * When a server key is listed in config.disabledMcpServers, that MCP server is unavailable.
 * When the list is missing, empty, or invalid, every server stays available and the prompt configuration is unchanged.
 * When the flag or its config is not an object, the fallback configuration is used.
 */
import { describe, expect, it } from 'vitest'

import {
  AI_BUILDER_FEATURE_FLAG,
  AI_BUILDER_FEATURE_FLAG_FALLBACK,
} from '@/config/flags'
import { getAiBuilderFlag } from '@/helpers/ai/get-ai-builder-flag'

const promptConfig = {
  chatPromptName: 'custom-chat',
  chatSummaryPromptName: 'custom-summary',
  version: 'canary',
}

function resolveFlag(config: Record<string, unknown>, enabled: boolean) {
  return getAiBuilderFlag({
    [AI_BUILDER_FEATURE_FLAG]: {
      enabled,
      config: {
        ...promptConfig,
        ...config,
      },
    },
  })
}

const availableFlag = {
  enabled: true,
  config: {
    ...promptConfig,
    disabledMcpServers: [] as string[],
  },
}

describe('getAiBuilderFlag disabledMcpServers', () => {
  it('lists each server once and keeps the prompt fields', () => {
    expect(
      resolveFlag(
        { disabledMcpServers: ['gitbook', 'formsgGitbook', 'gitbook'] },
        false,
      ),
    ).toEqual({
      enabled: false,
      config: {
        ...promptConfig,
        disabledMcpServers: ['formsgGitbook', 'gitbook'],
      },
    })
  })

  it.each<[string, Record<string, unknown>]>([
    ['the list is empty', { disabledMcpServers: [] }],
    ['the list is missing', {}],
    ['the list is an object', { disabledMcpServers: { gitbook: false } }],
    ['an entry is not a string', { disabledMcpServers: ['gitbook', false] }],
    ['an entry is empty', { disabledMcpServers: ['gitbook', ''] }],
  ])('keeps every server available when %s', (_label, config) => {
    expect(resolveFlag(config, true)).toEqual(availableFlag)
  })

  it.each<[string, Record<string, unknown>]>([
    ['the flag is missing', {}],
    [
      'config is null',
      { [AI_BUILDER_FEATURE_FLAG]: { enabled: true, config: null } },
    ],
    [
      'config is an array',
      { [AI_BUILDER_FEATURE_FLAG]: { enabled: true, config: [] } },
    ],
  ])('uses the fallback when %s', (_label, flags) => {
    expect(getAiBuilderFlag(flags)).toEqual(AI_BUILDER_FEATURE_FLAG_FALLBACK)
  })
})

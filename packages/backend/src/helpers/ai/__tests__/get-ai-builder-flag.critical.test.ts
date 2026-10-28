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

describe('getAiBuilderFlag disabledMcpServers', () => {
  it('lists GitBook as unavailable and keeps the prompt fields', () => {
    expect(resolveFlag({ disabledMcpServers: ['gitbook'] }, false)).toEqual({
      enabled: false,
      config: {
        ...promptConfig,
        disabledMcpServers: ['gitbook'],
      },
    })
  })

  it('keeps every server available when the list is empty and keeps the prompt fields', () => {
    expect(resolveFlag({ disabledMcpServers: [] }, true)).toEqual({
      enabled: true,
      config: {
        ...promptConfig,
        disabledMcpServers: [],
      },
    })
  })

  it('keeps every server available when the list is missing and keeps the prompt fields', () => {
    expect(resolveFlag({}, true)).toEqual({
      enabled: true,
      config: {
        ...promptConfig,
        disabledMcpServers: [],
      },
    })
  })

  it('keeps every server available when the list is not an array and keeps the prompt fields', () => {
    expect(resolveFlag({ disabledMcpServers: 'off' }, true)).toEqual({
      enabled: true,
      config: {
        ...promptConfig,
        disabledMcpServers: [],
      },
    })
  })

  it('keeps every server available when the list uses the old object shape', () => {
    expect(
      resolveFlag({ disabledMcpServers: { gitbook: false } }, true),
    ).toEqual({
      enabled: true,
      config: {
        ...promptConfig,
        disabledMcpServers: [],
      },
    })
  })

  it('keeps every server available when a listed value is not a string', () => {
    expect(
      resolveFlag({ disabledMcpServers: ['gitbook', false] }, true),
    ).toEqual({
      enabled: true,
      config: {
        ...promptConfig,
        disabledMcpServers: [],
      },
    })
  })

  it('deduplicates listed servers and keeps the prompt fields', () => {
    expect(
      resolveFlag(
        { disabledMcpServers: ['formsgGitbook', 'gitbook', 'gitbook'] },
        true,
      ),
    ).toEqual({
      enabled: true,
      config: {
        ...promptConfig,
        disabledMcpServers: ['formsgGitbook', 'gitbook'],
      },
    })
  })

  it('uses the fallback when config is not an object', () => {
    expect(
      getAiBuilderFlag({
        [AI_BUILDER_FEATURE_FLAG]: { enabled: true, config: null },
      }),
    ).toEqual(AI_BUILDER_FEATURE_FLAG_FALLBACK)
  })

  it('uses the fallback when the flag is missing', () => {
    expect(getAiBuilderFlag({})).toEqual(AI_BUILDER_FEATURE_FLAG_FALLBACK)
  })
})

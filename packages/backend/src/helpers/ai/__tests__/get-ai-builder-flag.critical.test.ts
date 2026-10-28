/**
 * When a config.mcpServers value is false, that MCP server is unavailable.
 * When a server value is true, missing, or not a boolean, that server stays available and the prompt configuration is unchanged.
 */
import { describe, expect, it } from 'vitest'

import { AI_BUILDER_FEATURE_FLAG } from '@/config/flags'
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

describe('getAiBuilderFlag mcpServers', () => {
  it('reports GitBook unavailable when gitbook is false and keeps the prompt fields', () => {
    expect(resolveFlag({ mcpServers: { gitbook: false } }, true)).toEqual({
      enabled: true,
      config: {
        ...promptConfig,
        mcpServers: { gitbook: false },
      },
    })
  })

  it('keeps GitBook available when gitbook is true and keeps the prompt fields', () => {
    expect(resolveFlag({ mcpServers: { gitbook: true } }, false)).toEqual({
      enabled: false,
      config: {
        ...promptConfig,
        mcpServers: { gitbook: true },
      },
    })
  })

  it('keeps GitBook available when mcpServers is missing and keeps the prompt fields', () => {
    expect(resolveFlag({}, true)).toEqual({
      enabled: true,
      config: {
        ...promptConfig,
        mcpServers: { gitbook: true },
      },
    })
  })

  it('keeps GitBook available when gitbook is missing and keeps the prompt fields', () => {
    expect(resolveFlag({ mcpServers: {} }, true)).toEqual({
      enabled: true,
      config: {
        ...promptConfig,
        mcpServers: { gitbook: true },
      },
    })
  })

  it('keeps GitBook available when gitbook is not a boolean and keeps the prompt fields', () => {
    expect(resolveFlag({ mcpServers: { gitbook: 'false' } }, true)).toEqual({
      enabled: true,
      config: {
        ...promptConfig,
        mcpServers: { gitbook: true },
      },
    })
  })

  it('keeps the prompt fields when mcpServers is invalid', () => {
    expect(resolveFlag({ mcpServers: 'off' }, true)).toEqual({
      enabled: true,
      config: {
        ...promptConfig,
        mcpServers: { gitbook: true },
      },
    })
  })

  it('keeps each server value when the flag names more than one server', () => {
    expect(
      resolveFlag(
        {
          mcpServers: {
            gitbook: true,
            formsgGitbook: false,
            draftServer: 'false',
          },
        },
        true,
      ),
    ).toEqual({
      enabled: true,
      config: {
        ...promptConfig,
        mcpServers: {
          gitbook: true,
          formsgGitbook: false,
          draftServer: true,
        },
      },
    })
  })
})

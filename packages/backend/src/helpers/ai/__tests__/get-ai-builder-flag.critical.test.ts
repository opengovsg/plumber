/**
 * When a known server key is listed in config.disabledMcpServers, that MCP server is unavailable.
 * Unknown keys, empty strings, and non-string entries are dropped. Remaining known keys still apply.
 * When the list is missing or not an array, every server stays available and the prompt configuration is unchanged.
 * When the flag or its config is not an object, the fallback configuration is used.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AI_BUILDER_FEATURE_FLAG,
  AI_BUILDER_FEATURE_FLAG_FALLBACK,
} from '@/config/flags'
import { getAiBuilderFlag } from '@/helpers/ai/get-ai-builder-flag'
import logger from '@/helpers/logger'

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
  beforeEach(() => {
    vi.spyOn(logger, 'warn').mockImplementation(() => logger)
  })

  afterEach(() => {
    vi.mocked(logger.warn).mockRestore()
  })

  it.each<[string, unknown, string[], unknown[] | undefined]>([
    [
      'keeps a known server once and drops bad entries',
      ['gitbook', 'gitbook', 'GitBook', '', false],
      ['gitbook'],
      ['GitBook', '', false],
    ],
    ['drops an unknown server name', ['GitBook'], [], ['GitBook']],
  ])('%s', (_label, input, disabled, rejected) => {
    expect(resolveFlag({ disabledMcpServers: input }, false)).toEqual({
      enabled: false,
      config: {
        ...promptConfig,
        disabledMcpServers: disabled,
      },
    })
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith(
      'Rejected disabledMcpServers entries',
      { rejected },
    )
  })

  it.each<[string, Record<string, unknown>]>([
    ['the list is empty', { disabledMcpServers: [] }],
    ['the list is missing', {}],
  ])('keeps every server available when %s', (_label, config) => {
    expect(resolveFlag(config, true)).toEqual(availableFlag)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('keeps every server available when the list is not an array', () => {
    const disabledMcpServers = { gitbook: false }
    expect(resolveFlag({ disabledMcpServers }, true)).toEqual(availableFlag)
    expect(logger.warn).toHaveBeenCalledWith(
      'Rejected disabledMcpServers value',
      { disabledMcpServers },
    )
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
    expect(logger.warn).not.toHaveBeenCalled()
  })
})

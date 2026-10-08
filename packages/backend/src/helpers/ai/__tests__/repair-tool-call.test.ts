import {
  InvalidToolInputError,
  type LanguageModel,
  NoSuchToolError,
  readUIMessageStream,
  streamText,
  tool,
  type ToolSet,
} from 'ai'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod/v4'

import {
  repairMalformedStreamedToolNames,
  repairMalformedToolName,
} from '../repair-tool-call'

vi.mock('@/helpers/logger', () => ({
  default: { warn: vi.fn() },
}))

const tools = { list_apps: {}, get_form_schema: {} } as unknown as ToolSet

function repair(toolName: string, error?: Error) {
  return repairMalformedToolName({
    system: undefined,
    messages: [],
    toolCall: {
      type: 'tool-call',
      toolCallId: 'tooluse_1',
      toolName,
      input: '{}',
    },
    tools,
    inputSchema: () => ({}),
    error: (error ??
      new NoSuchToolError({
        toolName,
        availableTools: Object.keys(tools),
      })) as NoSuchToolError,
  })
}

describe('repairMalformedToolName', () => {
  it('strips trailing markup from a tool name that matches a registered tool', async () => {
    expect(await repair('list_apps" />')).toEqual({
      type: 'tool-call',
      toolCallId: 'tooluse_1',
      toolName: 'list_apps',
      input: '{}',
    })
  })

  it('returns null when the cleaned name is not a registered tool', async () => {
    expect(await repair('made_up_tool" />')).toBeNull()
  })

  it('returns null for names that are only inherited object properties', async () => {
    expect(await repair('toString" />')).toBeNull()
  })

  it('returns null when a registered name is followed by non-markup text', async () => {
    expect(await repair('list_apps:preview')).toBeNull()
    expect(await repair('list_apps" /> extra')).toBeNull()
  })

  it('returns null when nothing valid precedes the junk', async () => {
    expect(await repair('" />')).toBeNull()
  })

  it('returns null for errors other than an unknown tool', async () => {
    const error = new InvalidToolInputError({
      toolName: 'list_apps',
      toolInput: '{',
      cause: new Error('bad json'),
    })
    expect(await repair('list_apps', error)).toBeNull()
  })
})

type LanguageModelV2 = Exclude<LanguageModel, string>
type LanguageModelV2StreamPart = Awaited<
  ReturnType<LanguageModelV2['doStream']>
>['stream'] extends ReadableStream<infer Part>
  ? Part
  : never

describe('streamText with a malformed tool name', () => {
  const badName = 'list_apps" />'

  const chunks: LanguageModelV2StreamPart[] = [
    { type: 'stream-start', warnings: [] },
    { type: 'tool-input-start', id: 'tooluse_1', toolName: badName },
    { type: 'tool-input-delta', id: 'tooluse_1', delta: '{}' },
    { type: 'tool-input-end', id: 'tooluse_1' },
    {
      type: 'tool-call',
      toolCallId: 'tooluse_1',
      toolName: badName,
      input: '{}',
    },
    {
      type: 'finish',
      finishReason: 'tool-calls',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    },
  ]

  function mockModel(parts: LanguageModelV2StreamPart[]): LanguageModelV2 {
    return {
      specificationVersion: 'v2',
      provider: 'mock',
      modelId: 'mock',
      supportedUrls: {},
      doGenerate: async () => {
        throw new Error('not used')
      },
      doStream: async () => ({
        stream: new ReadableStream<LanguageModelV2StreamPart>({
          start(controller) {
            parts.forEach((part) => controller.enqueue(part))
            controller.close()
          },
        }),
      }),
    }
  }

  async function streamWithBadName() {
    const execute = vi.fn().mockResolvedValue([{ key: 'slack' }])
    const result = streamText({
      model: mockModel(chunks),
      prompt: 'hi',
      tools: { list_apps: tool({ inputSchema: z.object({}), execute }) },
      experimental_repairToolCall: repairMalformedToolName,
      experimental_transform: repairMalformedStreamedToolNames,
    })

    let message
    for await (const m of readUIMessageStream({
      stream: result.toUIMessageStream(),
    })) {
      message = m
    }
    return { message, execute }
  }

  it('runs the tool and keeps the malformed name out of the UI message', async () => {
    const { message, execute } = await streamWithBadName()

    expect(execute).toHaveBeenCalledTimes(1)
    const toolParts = message?.parts.filter((p) => p.type.startsWith('tool-'))
    expect(toolParts).toHaveLength(1)
    expect(toolParts?.[0]).toMatchObject({
      type: 'tool-list_apps',
      state: 'output-available',
    })
  })
})

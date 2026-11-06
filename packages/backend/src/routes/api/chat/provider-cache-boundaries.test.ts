import { createBedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic'
import { generateText, type ModelMessage, stepCountIs, tool } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import z from 'zod'

import { buildChatSystemMessages } from './build-chat-system-messages'
import {
  createCacheBreakpointPreparer,
  sortToolsByName,
} from './cache-breakpoints'

vi.mock('@/apps', () => ({
  default: {
    'm365-excel': { key: 'm365-excel', name: 'M365 Excel' },
    slack: { key: 'slack', name: 'Slack' },
  },
}))

vi.mock('@/services/mcp/list-connections', () => ({
  listConnectionsService: vi.fn(),
}))

const BASE_PROMPT = [
  'You build pipes. Support: {{SUPPORT_FORM_URL}}',
  '| App | Key |',
  '| --- | --- |',
  '| M365 Excel | `m365-excel` |',
  '| Slack | `slack` |',
].join('\n')

const CHAT_A = '11111111-1111-4111-8111-111111111111'
const CHAT_B = '22222222-2222-4222-8222-222222222222'

type AnthropicBlock = Record<string, unknown> & { type: string }
interface AnthropicRequestBody {
  system: AnthropicBlock[]
  tools: AnthropicBlock[]
  messages: { role: string; content: AnthropicBlock[] }[]
}

function anthropicResponse(content: unknown[], stopReason: string) {
  return new Response(
    JSON.stringify({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'global.anthropic.claude-sonnet-5-5',
      content,
      stop_reason: stopReason,
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

async function runTwoSteps({
  chatId,
  restrictedApps,
  history,
  withConnection,
}: {
  chatId: string
  restrictedApps: string[]
  history: ModelMessage[]
  withConnection: boolean
}): Promise<AnthropicRequestBody[]> {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      anthropicResponse(
        [
          {
            type: 'tool_use',
            id: 'call-1',
            name: 'create_pipe',
            input: { name: 'My pipe' },
          },
        ],
        'tool_use',
      ),
    )
    .mockResolvedValueOnce(
      anthropicResponse([{ type: 'text', text: 'Done.' }], 'end_turn'),
    )
  const bedrock = createBedrockAnthropic({
    region: 'ap-southeast-1',
    apiKey: 'test-key',
    fetch: fetchMock,
  })

  await generateText({
    model: bedrock('global.anthropic.claude-sonnet-5-5'),
    messages: [
      ...buildChatSystemMessages({
        basePrompt: BASE_PROMPT,
        restrictedApps,
        chatId,
        establishedFormConnection: withConnection
          ? { connectionId: 'conn-1', formTitle: 'Leave form' }
          : null,
      }),
      ...history,
    ],
    // Deliberately out of order, as a GitBook tool list may arrive.
    tools: sortToolsByName({
      update_step: tool({
        description: 'Update a step',
        inputSchema: z.object({ step_id: z.string() }),
        execute: async () => ({ ok: true }),
      }),
      create_pipe: tool({
        description: 'Create a pipe',
        inputSchema: z.object({ name: z.string() }),
        execute: async () => ({ pipeId: 'pipe-1' }),
      }),
    }),
    prepareStep: createCacheBreakpointPreparer(),
    stopWhen: stepCountIs(2),
  })

  return fetchMock.mock.calls.map(([, init]) =>
    JSON.parse((init as RequestInit).body as string),
  )
}

function cachedBlockPaths(body: AnthropicRequestBody): string[] {
  const paths: string[] = []
  body.tools.forEach(
    (block, i) => block.cache_control && paths.push(`tools.${i}`),
  )
  body.system.forEach(
    (block, i) => block.cache_control && paths.push(`system.${i}`),
  )
  body.messages.forEach((message, i) =>
    message.content.forEach(
      (block, j) => block.cache_control && paths.push(`messages.${i}.${j}`),
    ),
  )
  return paths
}

function withoutCacheControl(blocks: AnthropicBlock[]): AnthropicBlock[] {
  return blocks.map(({ cache_control: _cacheControl, ...rest }) => ({
    ...rest,
    type: rest.type as string,
  }))
}

const history: ModelMessage[] = [
  { role: 'user', content: 'Make a pipe for my leave form.' },
  { role: 'assistant', content: 'Which form should I use?' },
  {
    role: 'user',
    content: [{ type: 'text', text: 'The one called "Leave form" {{x}}.' }],
  },
]

describe('Bedrock request cache boundaries', () => {
  it('shares the cached prefix across chats and puts chat-specific content after it', async () => {
    const [a] = await runTwoSteps({
      chatId: CHAT_A,
      restrictedApps: [],
      history,
      withConnection: true,
    })
    const [b] = await runTwoSteps({
      chatId: CHAT_B,
      restrictedApps: [],
      history: [{ role: 'user', content: 'Hi' }],
      withConnection: false,
    })

    expect(a.tools).toEqual(b.tools)
    expect(a.tools.map((t) => t.name)).toEqual(['create_pipe', 'update_step'])
    expect(a.system[0]).toEqual(b.system[0])
    expect(a.system[0].cache_control).toEqual({ type: 'ephemeral' })
    expect(a.system[0].text).toContain('Support: {{SUPPORT_FORM_URL}}')
    expect(a.system[0].text).not.toContain(CHAT_A)
    expect(a.system[0].text).not.toContain('conn-1')
    expect(a.system).toHaveLength(2)
    expect(a.system[1].cache_control).toBeUndefined()
    expect(a.system[1].text).toContain(CHAT_A)
    expect(a.system[1].text).toContain('connection_id "conn-1"')
  })

  it('places rolling conversation breakpoints within the 4-breakpoint limit', async () => {
    const [step1, step2] = await runTwoSteps({
      chatId: CHAT_A,
      restrictedApps: [],
      history,
      withConnection: false,
    })

    expect(cachedBlockPaths(step1)).toEqual(['system.0', 'messages.2.0'])
    expect(step2.messages.map((m) => m.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
      'user',
    ])
    expect(cachedBlockPaths(step2)).toEqual([
      'system.0',
      'messages.2.0',
      'messages.4.0',
    ])
  })

  it('sends user messages unchanged apart from cache markers', async () => {
    const [step1, step2] = await runTwoSteps({
      chatId: CHAT_A,
      restrictedApps: [],
      history,
      withConnection: false,
    })

    for (const body of [step1, step2]) {
      expect(withoutCacheControl(body.messages[0].content)).toEqual([
        { type: 'text', text: 'Make a pipe for my leave form.' },
      ])
      expect(withoutCacheControl(body.messages[2].content)).toEqual([
        { type: 'text', text: 'The one called "Leave form" {{x}}.' },
      ])
    }
  })
})

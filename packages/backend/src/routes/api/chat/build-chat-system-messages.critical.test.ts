/**
 * Business rules:
 * - "Preserve permission filtering and connection ownership checks."
 * - "Users with different permissions must receive the correct instructions."
 */
import { describe, expect, it, vi } from 'vitest'

import { buildChatSystemMessages } from './build-chat-system-messages'

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
  'Support: {{SUPPORT_FORM_URL}}',
  '| App | Key |',
  '| --- | --- |',
  '| M365 Excel | `m365-excel` |',
  '| Slack | `slack` |',
  '- M365 Excel: use updateTableRow',
  '- Slack: use sendMessage',
].join('\n')

function build(
  restrictedApps: string[],
  establishedFormConnection: Parameters<
    typeof buildChatSystemMessages
  >[0]['establishedFormConnection'] = null,
) {
  return buildChatSystemMessages({
    basePrompt: BASE_PROMPT,
    restrictedApps,
    chatId: '11111111-1111-4111-8111-111111111111',
    establishedFormConnection,
  })
}

describe('buildChatSystemMessages permissions', () => {
  it('removes restricted apps from the cached instructions', () => {
    const [cached] = build(['m365-excel'])

    expect(cached.content).not.toContain('| M365 Excel |')
    expect(cached.content).not.toContain('- M365 Excel:')
    expect(cached.content).toContain('| Slack |')
    expect(cached.content).toContain(
      'this user does not have access to the following apps: m365-excel',
    )
  })

  it('gives users with different permissions different cached instructions', () => {
    const [unrestricted] = build([])
    const [noExcel] = build(['m365-excel'])
    const [noSlack] = build(['slack'])

    expect(unrestricted.content).toContain('| M365 Excel |')
    expect(unrestricted.content).not.toContain('does not have access')
    expect(
      new Set([unrestricted, noExcel, noSlack].map((m) => m.content)).size,
    ).toBe(3)
  })

  it('keeps permission instructions out of the chat-specific block', () => {
    const [, chatContext] = build(['m365-excel'])

    expect(chatContext.content).not.toContain('m365-excel')
  })
})

describe('buildChatSystemMessages connection reminder', () => {
  it('adds no connection reminder without a verified connection', () => {
    const [cached, chatContext] = build([])

    expect(cached.content).not.toContain('connection_id')
    expect(chatContext.content).not.toContain('connection_id')
  })

  it('puts only the verified connection in the chat-specific block', () => {
    const [cached, chatContext] = build([], {
      connectionId: 'conn-1',
      formTitle: 'Leave form',
    })

    expect(cached.content).not.toContain('conn-1')
    expect(chatContext.content).toContain('connection_id "conn-1"')
  })
})

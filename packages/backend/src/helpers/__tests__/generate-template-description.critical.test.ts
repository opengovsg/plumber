// Business rule: the description should be auto-genearted via a vercel ai gateway call based off the steps content.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  gatewayModel: vi.fn(() => 'gateway-model'),
  createGateway: vi.fn(),
  config: { apiKey: 'test-key', model: 'openai/gpt-4o-mini' },
}))
vi.mock('ai', () => ({
  generateText: mocks.generateText,
  createGateway: mocks.createGateway,
}))
vi.mock('@/config/app', () => ({
  default: { templateDescription: mocks.config },
}))
vi.mock('@/apps', () => ({
  default: {
    postman: {
      name: 'Postman',
      actions: [
        {
          key: 'sendTransactionalEmail',
          name: 'Send email',
          description: 'Sends an email',
          substeps: [
            { arguments: [{ key: 'body' }, { key: 'destinationEmail' }] },
          ],
        },
      ],
    },
    toolbox: { name: 'Toolbox', actions: [{ key: 'ifThen', name: 'If' }] },
  },
}))

import {
  buildTemplateDescriptionContent,
  generateTemplateDescription,
} from '../generate-template-description'

const steps = [
  {
    id: 'email-id',
    position: 3,
    type: 'action' as const,
    appKey: 'postman',
    key: 'sendTransactionalEmail',
    parameters: {
      body: 'confidential message',
      destinationEmail: 'private@example.com',
      apiKey: 'secret',
    },
    config: {},
  },
  {
    id: 'block-id',
    position: 2,
    type: 'action' as const,
    appKey: 'toolbox',
    key: 'ifThen',
    parameters: { branchName: 'private branch name' },
    config: { endStepId: 'email-id' },
  },
]

describe('template description generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.config.apiKey = 'test-key'
    mocks.createGateway.mockReturnValue(mocks.gatewayModel)
    mocks.generateText.mockResolvedValue({
      text: ' Sends email when the conditions are met. ',
    })
  })

  it('calls Vercel AI Gateway with step structure and returns a trimmed description', async () => {
    expect(await generateTemplateDescription(steps)).toBe(
      'Sends email when the conditions are met.',
    )
    expect(mocks.createGateway).toHaveBeenCalledWith({ apiKey: 'test-key' })
    expect(mocks.gatewayModel).toHaveBeenCalledWith('openai/gpt-4o-mini')
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gateway-model',
        maxRetries: 0,
        maxOutputTokens: 200,
        prompt: JSON.stringify({
          steps: buildTemplateDescriptionContent(steps),
        }),
        abortSignal: expect.any(AbortSignal),
      }),
    )
  })

  it('includes configured field keys and logical positions without literal inputs or raw IDs', () => {
    const content = buildTemplateDescriptionContent(steps)
    expect(content[0]).toMatchObject({
      position: 2,
      event: 'If',
      blockEndsAt: 3,
    })
    expect(content[1].configuredFields).toEqual(['body', 'destinationEmail'])
    const serialized = JSON.stringify(content)
    for (const privateValue of [
      'confidential message',
      'private@example.com',
      'secret',
      'private branch name',
      'email-id',
      'block-id',
    ]) {
      expect(serialized).not.toContain(privateValue)
    }
  })

  it('fails without gateway credentials instead of using another provider', async () => {
    mocks.config.apiKey = ''
    await expect(generateTemplateDescription(steps)).rejects.toThrow(
      'not configured',
    )
    expect(mocks.generateText).not.toHaveBeenCalled()
  })

  it.each(['', ' '.repeat(5), 'x'.repeat(2001)])(
    'rejects invalid generated content',
    async (text) => {
      mocks.generateText.mockResolvedValue({ text })
      await expect(generateTemplateDescription(steps)).rejects.toThrow()
    },
  )
})

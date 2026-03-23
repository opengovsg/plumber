import { beforeEach, describe, expect, it, vi } from 'vitest'

import generateAiSteps from '@/graphql/mutations/ai/generate-ai-steps'

const mocks = vi.hoisted(() => ({
  generateObject: vi.fn(),
  langfusePromptGet: vi.fn(),
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
  getLdFlagValue: vi.fn(),
  getLangfuseClient: vi.fn(),
}))

vi.mock('ai', () => ({
  generateObject: mocks.generateObject,
}))

vi.mock('@/helpers/langfuse', () => ({
  getLangfuseClient: mocks.getLangfuseClient,
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

const DEFAULT_MOCKED_TRIGGER = {
  appKey: 'formsg',
  key: 'newSubmission',
  description:
    'This is a formsg trigger, which starts the workflow when a new submission is received',
  position: 1,
  type: 'trigger',
  config: {
    stepName: 'New FormSG submission',
    templateConfig: {},
  },
}

const DEFAULT_MOCKED_ACTIONS = [
  {
    appKey: 'postman',
    key: 'sendTransactionalEmail',
    description: 'This is a postman action, which sends a transactional email',
    type: 'action',
    config: {
      stepName: 'Send a welcome email to the new user',
      templateConfig: {},
    },
    position: 2,
  },
  {
    appKey: 'postman-sms',
    key: 'sendSms',
    description: 'This is a postman action, which sends a SMS',
    type: 'action',
    config: {
      stepName: 'Send a welcome SMS to the new user',
      templateConfig: {},
    },
    position: 3,
  },
]

const DEFAULT_MOCKED_OUTPUT = {
  object: {
    trigger: DEFAULT_MOCKED_TRIGGER,
    actions: DEFAULT_MOCKED_ACTIONS,
    name: 'Build with AI',
  },
}

const DEFAULT_INPUT = {
  prompt:
    '#### Start the workflow\nNew FormSG submission\n\n#### Actions\nSend a welcome email to the new user\nSend a welcome SMS to the new user',
  sessionId: '123',
}

describe('generateAiSteps mutation', () => {
  let context: any

  beforeEach(async () => {
    vi.resetAllMocks()

    mocks.langfusePromptGet.mockResolvedValue({
      prompt: 'system prompt',
      toJSON: vi.fn(),
    })
    mocks.getAllLdFlags.mockResolvedValue({
      'ai-builder': {
        enabled: true,
        config: {
          generateStepsPromptName: 'generate-steps',
          version: 'production',
        },
      },
    })
    mocks.getRestrictedAppKeys.mockReturnValueOnce([])
    mocks.generateObject.mockImplementation(async ({ schema, ...payload }) => ({
      object: schema.parse(
        payload.outputObject ?? DEFAULT_MOCKED_OUTPUT.object,
      ),
    }))

    context = {
      currentUser: {
        email: 'mario@open.gov.sg',
      },
    }
  })

  it('should generate steps with valid input', async () => {
    mocks.generateObject.mockResolvedValueOnce(DEFAULT_MOCKED_OUTPUT)
    mocks.getRestrictedAppKeys.mockReturnValueOnce([])

    const result = await generateAiSteps(
      null,
      { input: DEFAULT_INPUT },
      context,
    )

    expect(result.trigger).toStrictEqual(DEFAULT_MOCKED_TRIGGER)
    expect(result.actions).toStrictEqual(DEFAULT_MOCKED_ACTIONS)
  })

  it('should throw an error if the input is invalid', async () => {
    await expect(
      generateAiSteps(
        null,
        {
          input: {
            prompt: 'gibberish',
            sessionId: '123',
          },
        },
        context,
      ),
    ).rejects.toThrow('Prompt must be at least 15 characters')
  })

  it('should map step positions correctly', async () => {
    mocks.generateObject.mockResolvedValueOnce(DEFAULT_MOCKED_OUTPUT)
    mocks.getRestrictedAppKeys.mockReturnValueOnce([])

    const result = await generateAiSteps(
      null,
      { input: DEFAULT_INPUT },
      context,
    )
    const parsedResult = result as any

    expect(parsedResult.trigger.position).toBe(1)
    expect(parsedResult.actions[0].position).toBe(2)
    expect(parsedResult.actions[1].position).toBe(3)
  })

  it('should throw when generated output contains restricted app keys', async () => {
    mocks.getRestrictedAppKeys.mockReturnValueOnce(['aisay'])
    mocks.generateObject.mockImplementationOnce(async ({ schema }) => ({
      object: schema.parse({
        trigger: DEFAULT_MOCKED_TRIGGER,
        actions: [
          {
            appKey: 'aisay',
            key: 'sendMessage',
            description: 'Send a generated AI message',
            type: 'action',
            config: {
              stepName: 'Send AI message',
              templateConfig: {},
            },
            position: 2,
          },
        ],
        name: 'Build with AI',
      }),
    }))

    await expect(
      generateAiSteps(null, { input: DEFAULT_INPUT }, context),
    ).rejects.toThrow('Invalid input')
  })

  it('should throw when generated output contains a restricted trigger app key', async () => {
    mocks.getRestrictedAppKeys.mockReturnValueOnce(['gathersg'])
    mocks.generateObject.mockImplementationOnce(async ({ schema }) => ({
      object: schema.parse({
        trigger: {
          appKey: 'gathersg',
          key: 'newCase',
          description: 'This is a gathersg trigger',
          position: 1,
          type: 'trigger',
          config: {
            stepName: 'New GatherSG case',
            templateConfig: {},
          },
        },
        actions: DEFAULT_MOCKED_ACTIONS,
        name: 'Build with AI',
      }),
    }))

    await expect(
      generateAiSteps(null, { input: DEFAULT_INPUT }, context),
    ).rejects.toThrow('Invalid input')
  })
})

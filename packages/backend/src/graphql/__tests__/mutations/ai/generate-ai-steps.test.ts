import { beforeEach, describe, expect, it, vi } from 'vitest'

import generateAiSteps from '@/graphql/mutations/ai/generate-ai-steps'
import { Action } from '@/graphql/mutations/ai/schemas/actions.zod'
import { Trigger } from '@/graphql/mutations/ai/schemas/triggers.zod'

const mocks = vi.hoisted(() => ({
  generateObject: vi.fn(),
  langfusePromptGet: vi.fn(),
  getLdFlagValue: vi.fn(),
}))

vi.mock('ai', () => ({
  generateObject: mocks.generateObject,
}))

vi.mock('@/helpers/langfuse', () => ({
  langfuseClient: {
    prompt: {
      get: mocks.langfusePromptGet,
    },
  },
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
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
  },
}

const DEFAULT_INPUT = {
  prompt:
    '#### Start the workflow\nNew FormSG submission\n\n#### Actions\nSend a welcome email to the new user\nSend a welcome SMS to the new user',
  isFormMode: true,
  sessionId: '123',
}

describe('generateAiSteps mutation', () => {
  let context: any

  beforeEach(async () => {
    vi.resetAllMocks()

    mocks.langfusePromptGet.mockResolvedValue({ prompt: 'system prompt' })
    mocks.getLdFlagValue.mockResolvedValue({
      objectPrompt: 'ai-builder/form',
      version: 'production',
    })

    context = {
      currentUser: {
        email: 'mario@open.gov.sg',
      },
    }
  })

  it('should generate steps with valid input', async () => {
    mocks.generateObject.mockResolvedValueOnce(DEFAULT_MOCKED_OUTPUT)

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
            isFormMode: true,
            sessionId: '123',
          },
        },
        context,
      ),
    ).rejects.toThrow('Prompt must be at least 15 characters')
  })

  it('should map step positions correctly', async () => {
    mocks.generateObject.mockResolvedValueOnce(DEFAULT_MOCKED_OUTPUT)

    const result = await generateAiSteps(
      null,
      { input: DEFAULT_INPUT },
      context,
    )

    expect((result.trigger as Trigger).position).toBe(1)
    expect((result.actions as Action[])[0].position).toBe(2)
    expect((result.actions as Action[])[1].position).toBe(3)
  })
})

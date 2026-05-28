import { beforeEach, describe, expect, it, vi } from 'vitest'

import generateAiSteps from '@/graphql/mutations/ai/generate-ai-steps'

const mocks = vi.hoisted(() => ({
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

// A valid WORKFLOW_METADATA block using real app/trigger/action keys
const VALID_WORKFLOW_METADATA = `
<!-- WORKFLOW_METADATA
name: Welcome Email Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    stepName: New form submission
    description: Configure to trigger when a new FormSG submission is received
  - step: 2
    appKey: postman
    key: sendTransactionalEmail
    stepName: Send welcome email
    description: Send a transactional email to the new user using their email address
  - step: 3
    appKey: postman-sms
    key: sendSms
    stepName: Send welcome SMS
    description: Send an SMS to the new user using their phone number from the trigger
-->
`

const DEFAULT_INPUT = {
  prompt: VALID_WORKFLOW_METADATA,
  sessionId: '123',
  traceId: 'trace-abc',
}

describe('generateAiSteps mutation', () => {
  let context: any

  beforeEach(() => {
    vi.resetAllMocks()

    mocks.getAllLdFlags.mockResolvedValue({
      'ai-builder': {
        enabled: true,
        config: {},
      },
    })
    mocks.getRestrictedAppKeys.mockReturnValue([])

    context = {
      currentUser: {
        email: 'mario@open.gov.sg',
      },
    }
  })

  describe('valid WORKFLOW_METADATA', () => {
    it('should parse trigger and actions correctly', async () => {
      const result = await generateAiSteps(
        null,
        { input: DEFAULT_INPUT },
        context,
      )

      const { trigger, actions } = result as any

      expect(trigger).toMatchObject({
        type: 'trigger',
        appKey: 'formsg',
        key: 'newSubmission',
      })
      expect(actions).toHaveLength(2)
      expect(actions[0]).toMatchObject({
        type: 'action',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
      })
      expect(actions[1]).toMatchObject({
        type: 'action',
        appKey: 'postman-sms',
        key: 'sendSms',
      })
    })

    it('should use the name from WORKFLOW_METADATA', async () => {
      const result = await generateAiSteps(
        null,
        { input: DEFAULT_INPUT },
        context,
      )

      expect(result.name).toBe('Welcome Email Workflow')
    })

    it('should default name to "Build with AI" when not specified', async () => {
      const promptWithoutName = `
<!-- WORKFLOW_METADATA
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: New FormSG submission
  - step: 2
    appKey: postman
    key: sendTransactionalEmail
    description: Send email
-->
`
      const result = await generateAiSteps(
        null,
        { input: { ...DEFAULT_INPUT, prompt: promptWithoutName } },
        context,
      )

      expect(result.name).toBe('Build with AI')
    })

    it('should set config.stepName from stepName field', async () => {
      const result = await generateAiSteps(
        null,
        { input: DEFAULT_INPUT },
        context,
      )

      expect((result.actions as any[])[0].config.stepName).toBe(
        'Send welcome email',
      )
    })

    it('should fall back to key for config.stepName when stepName is absent', async () => {
      const promptWithoutStepName = `
<!-- WORKFLOW_METADATA
name: Welcome Email Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: Configure to trigger when a new FormSG submission is received
  - step: 2
    appKey: postman
    key: sendTransactionalEmail
    description: Send a transactional email to the new user
-->
`
      const result = await generateAiSteps(
        null,
        { input: { ...DEFAULT_INPUT, prompt: promptWithoutStepName } },
        context,
      )

      expect((result.actions as any[])[0].config.stepName).toBe(
        'sendTransactionalEmail',
      )
    })

    it('should map branchName to parameters.branchName for if-then steps', async () => {
      const promptWithIfThen = `
<!-- WORKFLOW_METADATA
name: Priority Routing
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    stepName: New form submission
    description: Configure to trigger when a new FormSG submission is received
  - step: 2
    appKey: toolbox
    key: ifThen
    stepName: Check priority
    description: Set the condition to check if the priority field equals High
    branchName: Priority is High
  - step: 3
    appKey: postman
    key: sendTransactionalEmail
    stepName: Send high priority email
    description: Send an email for high priority submissions
-->
`
      const result = await generateAiSteps(
        null,
        { input: { ...DEFAULT_INPUT, prompt: promptWithIfThen } },
        context,
      )

      const { actions } = result as any
      expect(actions[0].parameters).toStrictEqual({
        depth: 0,
        branchName: 'Priority is High',
      })
    })

    it('should add templateConfig to each action', async () => {
      const result = await generateAiSteps(
        null,
        { input: DEFAULT_INPUT },
        context,
      )

      for (const action of result.actions as any[]) {
        expect(action.config.templateConfig).toStrictEqual({})
      }
    })

    it('should pass through the traceId from input', async () => {
      const result = await generateAiSteps(
        null,
        { input: { ...DEFAULT_INPUT, traceId: 'chat-trace-xyz' } },
        context,
      )

      expect(result.traceId).toBe('chat-trace-xyz')
    })
  })

  describe('invalid WORKFLOW_METADATA', () => {
    it('should throw when no WORKFLOW_METADATA block is present', async () => {
      await expect(
        generateAiSteps(
          null,
          {
            input: {
              ...DEFAULT_INPUT,
              prompt:
                'Just a regular assistant response with no workflow metadata',
            },
          },
          context,
        ),
      ).rejects.toThrow(
        'Unable to generate the workflow. Modify the prompt and try again.',
      )
    })

    it('should throw when WORKFLOW_METADATA contains malformed YAML', async () => {
      await expect(
        generateAiSteps(
          null,
          {
            input: {
              ...DEFAULT_INPUT,
              prompt: `<!-- WORKFLOW_METADATA
: this is not valid yaml: [unclosed bracket
-->`,
            },
          },
          context,
        ),
      ).rejects.toThrow(
        'Unable to generate the workflow. Modify the prompt and try again.',
      )
    })

    it('should throw when WORKFLOW_METADATA has no steps field', async () => {
      await expect(
        generateAiSteps(
          null,
          {
            input: {
              ...DEFAULT_INPUT,
              prompt: `<!-- WORKFLOW_METADATA
name: My Workflow
-->`,
            },
          },
          context,
        ),
      ).rejects.toThrow(
        'Unable to generate the workflow. Modify the prompt and try again.',
      )
    })

    it('should throw when WORKFLOW_METADATA has an empty steps array', async () => {
      await expect(
        generateAiSteps(
          null,
          {
            input: {
              ...DEFAULT_INPUT,
              prompt: `<!-- WORKFLOW_METADATA
name: My Workflow
steps: []
-->`,
            },
          },
          context,
        ),
      ).rejects.toThrow(
        'Unable to generate the workflow. Modify the prompt and try again.',
      )
    })

    it('should throw when trigger appKey does not exist', async () => {
      await expect(
        generateAiSteps(
          null,
          {
            input: {
              ...DEFAULT_INPUT,
              prompt: `<!-- WORKFLOW_METADATA
name: My Workflow
steps:
  - step: 1
    appKey: nonexistent-app
    key: someKey
    description: Some trigger
  - step: 2
    appKey: postman
    key: sendTransactionalEmail
    description: Send email
-->`,
            },
          },
          context,
        ),
      ).rejects.toThrow(
        'Invalid trigger detected. Modify the prompt and try again.',
      )
    })

    it('should throw when action key is invalid for the given appKey', async () => {
      await expect(
        generateAiSteps(
          null,
          {
            input: {
              ...DEFAULT_INPUT,
              prompt: `<!-- WORKFLOW_METADATA
name: My Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: New FormSG submission
  - step: 2
    appKey: postman
    key: nonExistentAction
    description: Some action
-->`,
            },
          },
          context,
        ),
      ).rejects.toThrow(
        'Invalid action detected at step 2. Modify the prompt and try again.',
      )
    })

    it('should throw when WORKFLOW_METADATA has only a trigger with no actions', async () => {
      // actionsSchema requires min 1 action — falls through to fromZodError
      await expect(
        generateAiSteps(
          null,
          {
            input: {
              ...DEFAULT_INPUT,
              prompt: `<!-- WORKFLOW_METADATA
name: My Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: New FormSG submission
-->`,
            },
          },
          context,
        ),
      ).rejects.toThrow('Array must contain at least 1 element')
    })

    it('should throw when trigger uses a restricted app', async () => {
      mocks.getRestrictedAppKeys.mockReturnValue(['formsg'])

      await expect(
        generateAiSteps(null, { input: DEFAULT_INPUT }, context),
      ).rejects.toThrow(
        'Invalid trigger detected. Modify the prompt and try again.',
      )
    })

    it('should throw when if-then is the last action with nothing after it', async () => {
      await expect(
        generateAiSteps(
          null,
          {
            input: {
              ...DEFAULT_INPUT,
              prompt: `<!-- WORKFLOW_METADATA
name: My Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: New FormSG submission
  - step: 2
    appKey: postman
    key: sendTransactionalEmail
    description: Send email
  - step: 3
    appKey: toolbox
    key: ifThen
    description: Check condition with nothing after
-->`,
            },
          },
          context,
        ),
      ).rejects.toThrow(
        'If-then actions must have another action immediately after them',
      )
    })

    it('should throw when if-then actions are consecutive', async () => {
      await expect(
        generateAiSteps(
          null,
          {
            input: {
              ...DEFAULT_INPUT,
              prompt: `<!-- WORKFLOW_METADATA
name: My Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: New FormSG submission
  - step: 2
    appKey: toolbox
    key: ifThen
    description: First if-then
  - step: 3
    appKey: toolbox
    key: ifThen
    description: Second if-then immediately after
  - step: 4
    appKey: postman
    key: sendTransactionalEmail
    description: Send email
-->`,
            },
          },
          context,
        ),
      ).rejects.toThrow(
        'If-then actions cannot be consecutive - must alternate with non-if-then actions',
      )
    })

    it('should throw when for-each is placed after an if-then', async () => {
      await expect(
        generateAiSteps(
          null,
          {
            input: {
              ...DEFAULT_INPUT,
              prompt: `<!-- WORKFLOW_METADATA
name: My Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: New FormSG submission
  - step: 2
    appKey: toolbox
    key: ifThen
    description: Check condition
  - step: 3
    appKey: postman
    key: sendTransactionalEmail
    description: Send email after if-then
  - step: 4
    appKey: toolbox
    key: forEach
    description: Loop after if-then (invalid)
-->`,
            },
          },
          context,
        ),
      ).rejects.toThrow(
        'For-each action cannot be placed after an if-then action',
      )
    })

    it('should throw when a delay action is placed after a for-each', async () => {
      await expect(
        generateAiSteps(
          null,
          {
            input: {
              ...DEFAULT_INPUT,
              prompt: `<!-- WORKFLOW_METADATA
name: My Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: New FormSG submission
  - step: 2
    appKey: toolbox
    key: forEach
    description: Loop through rows
  - step: 3
    appKey: delay
    key: delayFor
    description: Wait after loop (invalid)
-->`,
            },
          },
          context,
        ),
      ).rejects.toThrow('Delay action cannot be added after a for-each step')
    })

    it('should throw when WORKFLOW_METADATA contains more than one for-each', async () => {
      await expect(
        generateAiSteps(
          null,
          {
            input: {
              ...DEFAULT_INPUT,
              prompt: `<!-- WORKFLOW_METADATA
name: My Workflow
steps:
  - step: 1
    appKey: formsg
    key: newSubmission
    description: New FormSG submission
  - step: 2
    appKey: toolbox
    key: forEach
    description: Loop through each row
  - step: 3
    appKey: postman
    key: sendTransactionalEmail
    description: Send email
  - step: 4
    appKey: toolbox
    key: forEach
    description: Loop again
-->`,
            },
          },
          context,
        ),
      ).rejects.toThrow('There can only be 1 for-each action in each pipe')
    })

    it('should throw when an action uses a restricted app', async () => {
      // postman is action at index 0 → step 2
      mocks.getRestrictedAppKeys.mockReturnValue(['postman'])

      await expect(
        generateAiSteps(null, { input: DEFAULT_INPUT }, context),
      ).rejects.toThrow(
        'Invalid action detected at step 2. Modify the prompt and try again.',
      )
    })
  })

  describe('input validation', () => {
    it('should throw when prompt is too short', async () => {
      await expect(
        generateAiSteps(
          null,
          {
            input: {
              prompt: 'too short',
              sessionId: '123',
              traceId: 'trace-123',
            },
          },
          context,
        ),
      ).rejects.toThrow('Prompt must be at least 15 characters')
    })

    it('should throw when AI Builder flag is disabled', async () => {
      mocks.getAllLdFlags.mockResolvedValue({
        'ai-builder': { enabled: false, config: {} },
      })

      await expect(
        generateAiSteps(null, { input: DEFAULT_INPUT }, context),
      ).rejects.toThrow('You do not have permissions to use AI Builder!')
    })
  })
})

import { type IGlobalVariable } from '@plumber/types'
import { APICallError } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

const mocks = vi.hoisted(() => ({
  setActionItem: vi.fn(),
  generateObject: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: { error: mocks.logError },
}))

vi.mock('@/helpers/pair', () => ({
  model: {},
  structuredOutputProviderOptions: {},
}))

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateObject: mocks.generateObject,
}))

import sendPromptAction from '@/apps/pair/actions/send-prompt'

describe('Send prompt action', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      user: { email: 'user@open.gov.sg' },
      flow: { id: 'flow-id' },
      step: {
        id: 'step-id',
        appKey: 'pair',
        key: sendPromptAction.key,
        parameters: {
          prompt: 'Summarise this text',
          responseFields: [{ fieldName: 'Summary', fieldType: 'text' }],
        },
      },
      execution: { id: 'execution-id', testRun: false },
      setActionItem: mocks.setActionItem,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('throws a config StepError for an invalid field', async () => {
    $.step.parameters.prompt = 'a'.repeat(10001)

    await expect(sendPromptAction.run($)).rejects.toSatisfy(
      (error) =>
        error instanceof StepError &&
        /Prompt cannot exceed 10,000 characters/.test(error.message) &&
        error.kind === 'config',
    )
    expect(mocks.generateObject).not.toHaveBeenCalled()
  })

  it.each([
    [400, 'internal'],
    [429, 'internal'],
    [503, 'third-party'],
  ])(
    'throws a StepError when the model call fails with status %i',
    async (statusCode, kind) => {
      mocks.generateObject.mockRejectedValue(
        new APICallError({
          message: 'litellm error',
          url: 'https://litellm.example.com/v1/chat/completions',
          requestBodyValues: {},
          statusCode,
        }),
      )

      await expect(sendPromptAction.run($)).rejects.toSatisfy(
        (error) =>
          error instanceof StepError &&
          /Failed to process prompt/.test(error.message) &&
          error.kind === kind,
      )
    },
  )

  it('logs the model error without its request body', async () => {
    mocks.generateObject.mockRejectedValue(
      new APICallError({
        message: 'Output blocked by content filtering policy',
        url: 'https://bedrock-runtime.ap-southeast-1.amazonaws.com/model/claude/invoke',
        requestBodyValues: { messages: [{ role: 'user', content: 'secret' }] },
        statusCode: 400,
      }),
    )

    await expect(sendPromptAction.run($)).rejects.toBeInstanceOf(StepError)
    expect(mocks.logError).toHaveBeenCalledWith('Failed to generate object', {
      errorName: 'AI_APICallError',
      errorMessage: 'Output blocked by content filtering policy',
      statusCode: 400,
      userId: 'user@open.gov.sg',
      flowId: 'flow-id',
      stepId: 'step-id',
      executionId: 'execution-id',
      tags: ['pair', 'action', 'generate-text'],
    })
  })
})

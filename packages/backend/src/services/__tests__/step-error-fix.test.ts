import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  openGitBookMcp: vi.fn(),
  generateText: vi.fn(),
  readFailedStep: vi.fn(),
  updateFailedStepParameters: vi.fn(),
}))

vi.mock('@/helpers/ai/gitbook-mcp', () => ({
  openGitBookMcp: mocks.openGitBookMcp,
}))

vi.mock('@/services/read-failed-step', () => ({
  readFailedStep: mocks.readFailedStep,
  updateFailedStepParameters: mocks.updateFailedStepParameters,
}))

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    generateText: mocks.generateText,
  }
})

vi.mock('@/helpers/pair', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/helpers/pair')>()
  return {
    ...actual,
    model: 'mock-model',
  }
})

import { generateText } from 'ai'

import { openGitBookMcp } from '@/helpers/ai/gitbook-mcp'
import type User from '@/models/user'

import {
  collectGuideLinks,
  fixStepError,
  GuideUnavailableError,
  sanitizeGuideAnswer,
  stepErrorFixRequestSchema,
} from '../step-error-fix'

const request = {
  stepId: '11111111-1111-4111-8111-111111111111',
  appName: 'Excel',
  appKey: 'm365-excel',
  stepKey: 'createTableRow',
  stepName: 'Create table row',
  errorName: 'Column not found',
  errorSolution: 'Check the column name in Excel.',
}

const user = { email: 'user@example.gov.sg' } as User

describe('collectGuideLinks', () => {
  it('keeps Plumber guide links and drops other urls', () => {
    const sources = collectGuideLinks({
      toolResults: [
        {
          url: 'https://guide.plumber.gov.sg/user-guides/actions/m365-excel',
        },
        { url: 'https://example.com/secret' },
        'See https://guide.plumber.gov.sg/user-guides/actions/formsg.',
      ],
    })

    expect(sources).toEqual([
      {
        title: 'M365 excel',
        url: 'https://guide.plumber.gov.sg/user-guides/actions/m365-excel',
      },
      {
        title: 'Formsg',
        url: 'https://guide.plumber.gov.sg/user-guides/actions/formsg',
      },
    ])
  })
})

describe('sanitizeGuideAnswer', () => {
  it('removes links outside the Plumber guide', () => {
    const answer = sanitizeGuideAnswer(
      'Read the [guide](https://guide.plumber.gov.sg/user-guides/actions/m365-excel) and ignore [this](https://evil.example/phish).',
      [
        {
          title: 'M365 excel',
          url: 'https://guide.plumber.gov.sg/user-guides/actions/m365-excel',
        },
      ],
    )

    expect(answer).toContain('guide.plumber.gov.sg')
    expect(answer).not.toContain('evil.example')
    expect(answer).toContain('ignore this')
  })
})

describe('stepErrorFixRequestSchema', () => {
  it('requires the failed step id', () => {
    const { stepId: _stepId, ...withoutStepId } = request
    expect(stepErrorFixRequestSchema.safeParse(withoutStepId).success).toBe(
      false,
    )
    expect(stepErrorFixRequestSchema.safeParse(request).success).toBe(true)
  })
})

describe('fixStepError', () => {
  const close = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.openGitBookMcp.mockResolvedValue({
      tools: { searchDocumentation: vi.fn() },
      close,
    })
    mocks.generateText.mockResolvedValue({
      text: 'No safe automatic fix. See https://guide.plumber.gov.sg/user-guides/actions/m365-excel.',
      steps: [],
    })
    mocks.updateFailedStepParameters.mockResolvedValue({ updated: true })
  })

  it('reads the failed step and then searches the guide', async () => {
    const result = await fixStepError(request, {
      traceId: 'trace-1',
      user,
    })

    expect(openGitBookMcp).toHaveBeenCalledWith({
      source: 'gitbook',
      traceId: 'trace-1',
      userId: 'user@example.gov.sg',
    })
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.objectContaining({
          searchDocumentation: expect.any(Function),
          get_step: expect.objectContaining({
            execute: expect.any(Function),
          }),
          update_step_parameters: expect.objectContaining({
            execute: expect.any(Function),
          }),
        }),
        prompt: expect.stringContaining('Column not found'),
      }),
    )
    const options = vi.mocked(generateText).mock.calls[0][0]
    expect(options.prompt).not.toContain('details')
    const prepareStep = options.prepareStep as
      | ((args: { stepNumber: number }) => { toolChoice: unknown })
      | undefined
    expect(prepareStep?.({ stepNumber: 0 })).toEqual({
      toolChoice: { type: 'tool', toolName: 'get_step' },
    })
    expect(prepareStep?.({ stepNumber: 1 })).toEqual({
      toolChoice: {
        type: 'tool',
        toolName: 'searchDocumentation',
      },
    })
    expect(result.fixed).toBe(false)
    expect(result.sources[0]?.url).toBe(
      'https://guide.plumber.gov.sg/user-guides/actions/m365-excel',
    )
  })

  it('updates only the failed step and returns a summary', async () => {
    mocks.generateText.mockImplementation(async (options) => {
      const updateTool = options.tools?.update_step_parameters as {
        execute: (input: unknown) => Promise<unknown>
      }
      await updateTool.execute({
        parameters: { columnValues: { Name: '{{trigger.name}}' } },
        summary: 'Updated the Name column mapping.',
      })
      const prepareStep = options.prepareStep as (args: {
        stepNumber: number
      }) => { toolChoice: unknown }
      expect(prepareStep({ stepNumber: 3 })).toEqual({ toolChoice: 'auto' })
      const stopWhen = options.stopWhen as Array<
        (args: { steps: unknown[] }) => boolean
      >
      expect(stopWhen.some((condition) => condition({ steps: [] }))).toBe(true)
      return {
        text: 'I can see the issue. The step configuration shows a long explanation.',
        steps: [],
      } as Awaited<ReturnType<typeof generateText>>
    })

    const result = await fixStepError(request, {
      traceId: 'trace-1',
      user,
    })

    expect(mocks.updateFailedStepParameters).toHaveBeenCalledWith(
      user,
      request.stepId,
      { appKey: request.appKey, stepKey: request.stepKey },
      { columnValues: { Name: '{{trigger.name}}' } },
      'trace-1',
    )
    expect(result).toMatchObject({
      fixed: true,
      summary: 'Updated the Name column mapping.',
    })
  })

  it('closes GitBook when the model call fails', async () => {
    mocks.generateText.mockRejectedValue(new Error('model down'))

    await expect(
      fixStepError(request, {
        traceId: 'trace-1',
        user,
      }),
    ).rejects.toThrow('model down')
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('fails closed when GitBook cannot be reached', async () => {
    mocks.openGitBookMcp.mockRejectedValue(new Error('connection refused'))

    await expect(
      fixStepError(request, {
        traceId: 'trace-1',
        user,
      }),
    ).rejects.toBeInstanceOf(GuideUnavailableError)
    expect(generateText).not.toHaveBeenCalled()
  })
})

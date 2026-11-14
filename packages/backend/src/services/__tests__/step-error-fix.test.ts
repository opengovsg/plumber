import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  connectGitbookMcp: vi.fn(),
  closeQuietly: vi.fn(),
  generateText: vi.fn(),
  updateFailedStepParameters: vi.fn(),
}))

vi.mock('@/helpers/ai/connect-gitbook-mcp', () => ({
  connectGitbookMcp: mocks.connectGitbookMcp,
  closeQuietly: mocks.closeQuietly,
}))

vi.mock('@/services/read-failed-step', () => ({
  readFailedStep: vi.fn(),
  updateFailedStepParameters: mocks.updateFailedStepParameters,
  replaceParameterKeysWithLabels: (summary: string) => summary,
}))

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: mocks.generateText,
}))

vi.mock('@/helpers/pair', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/helpers/pair')>()),
  model: 'mock-model',
}))

import type User from '@/models/user'

import {
  fixStepError,
  GuideUnavailableError,
  stepErrorFixRequestSchema,
  toUserSentence,
} from '../step-error-fix'

const request = {
  stepId: '11111111-1111-4111-8111-111111111111',
  appName: 'Excel',
  appKey: 'm365-excel',
  stepKey: 'createTableRow',
  stepName: 'Create table row',
  errorName: 'Column not found',
}

const user = { email: 'user@example.gov.sg' } as User
const gitbookClient = { close: vi.fn() }

type GenerateTextOptions = {
  tools: Record<string, { execute: (input: unknown) => Promise<unknown> }>
  prepareStep: (args: { stepNumber: number }) => { toolChoice: unknown }
}

describe('toUserSentence', () => {
  it('keeps the first sentence and removes ids', () => {
    expect(
      toUserSentence(
        'Tile 60eb454c-4246-464d-a6ff-e41d66555acf columns changed. **Select them again.**',
      ),
    ).toBe('Tile columns changed')
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
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.connectGitbookMcp.mockResolvedValue({
      client: gitbookClient,
      tools: { searchDocumentation: { execute: vi.fn() } },
    })
    mocks.generateText.mockResolvedValue({ text: 'No safe fix.', steps: [] })
    mocks.updateFailedStepParameters.mockResolvedValue({ updated: true })
  })

  it('reads the step, then searches the guide, then must explain', async () => {
    const result = await fixStepError(request, { traceId: 'trace-1', user })

    const options = mocks.generateText.mock.calls[0][0] as GenerateTextOptions
    expect(Object.keys(options.tools).sort()).toEqual([
      'explain_result',
      'get_step',
      'list_columns',
      'searchDocumentation',
      'update_step_parameters',
    ])
    expect(
      [0, 1, 4].map((stepNumber) => options.prepareStep({ stepNumber })),
    ).toEqual([
      { toolChoice: { type: 'tool', toolName: 'get_step' } },
      { toolChoice: { type: 'tool', toolName: 'searchDocumentation' } },
      { toolChoice: { type: 'tool', toolName: 'explain_result' } },
    ])
    expect(result).toEqual({ fixed: false, summary: 'No safe fix' })
    expect(mocks.closeQuietly).toHaveBeenCalledWith(gitbookClient)
  })

  it('updates only the failed step once and returns its summary', async () => {
    mocks.generateText.mockImplementation(
      async (options: GenerateTextOptions) => {
        const update = options.tools.update_step_parameters
        const input = {
          parameters: { columnValues: { Name: '{{trigger.name}}' } },
          summary: 'Updated the Name column mapping.',
        }
        await update.execute(input)
        await expect(update.execute(input)).resolves.toEqual({
          error: 'This step was already updated.',
        })
        return { text: 'A long explanation. More text.', steps: [] }
      },
    )

    const result = await fixStepError(request, { traceId: 'trace-1', user })

    expect(mocks.updateFailedStepParameters).toHaveBeenCalledOnce()
    expect(mocks.updateFailedStepParameters).toHaveBeenCalledWith(
      user,
      request.stepId,
      { appKey: request.appKey, stepKey: request.stepKey },
      { columnValues: { Name: '{{trigger.name}}' } },
      'trace-1',
    )
    expect(result).toEqual({
      fixed: true,
      summary: 'Updated the Name column mapping',
    })
  })

  it('closes GitBook when the model call fails', async () => {
    mocks.generateText.mockRejectedValue(new Error('model down'))

    await expect(
      fixStepError(request, { traceId: 'trace-1', user }),
    ).rejects.toThrow('model down')
    expect(mocks.closeQuietly).toHaveBeenCalledWith(gitbookClient)
  })

  it('fails closed when GitBook cannot be reached', async () => {
    mocks.connectGitbookMcp.mockRejectedValue(new Error('connection refused'))

    await expect(
      fixStepError(request, { traceId: 'trace-1', user }),
    ).rejects.toBeInstanceOf(GuideUnavailableError)
    expect(mocks.generateText).not.toHaveBeenCalled()
  })
})

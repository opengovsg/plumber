import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateStepParametersService: vi.fn(),
}))

vi.mock('@/services/mcp/update-step-parameters', () => ({
  updateStepParametersService: mocks.updateStepParametersService,
}))

import type User from '@/models/user'

import { readFailedStep, updateFailedStepParameters } from '../read-failed-step'

const stepId = '11111111-1111-4111-8111-111111111111'

function userWithStep(step: unknown): User {
  return {
    withAccessibleSteps: () => ({
      findById: () =>
        Object.assign(Promise.resolve(step), {
          withGraphFetched: async () => step,
        }),
    }),
  } as unknown as User
}

const savedStep = {
  id: stepId,
  flowId: '22222222-2222-4222-8222-222222222222',
  appKey: 'm365-excel',
  key: 'createTableRow',
  type: 'action',
  status: 'incomplete',
  parameters: {
    columnValues: { Name: '{{trigger.name}}' },
    secretKey: 'do-not-leak',
  },
  connection: {
    key: 'excel',
    formattedData: { screenName: 'Budget workbook' },
  },
}

describe('readFailedStep', () => {
  it('returns the saved fields and redacts secret-like keys', async () => {
    await expect(
      readFailedStep(userWithStep(savedStep), stepId, {
        appKey: 'm365-excel',
        stepKey: 'createTableRow',
      }),
    ).resolves.toMatchObject({
      connectionLabel: 'Budget workbook',
      parameters: {
        columnValues: { Name: '{{trigger.name}}' },
        secretKey: '[redacted]',
      },
      fields: expect.arrayContaining([
        expect.objectContaining({ key: 'columnValues' }),
      ]),
    })
  })

  it('rejects a step that does not match this check', async () => {
    await expect(
      readFailedStep(userWithStep(savedStep), stepId, {
        appKey: 'slack',
        stepKey: 'sendMessage',
      }),
    ).resolves.toEqual({
      error: 'The step does not match this Check step.',
    })
  })

  it('rejects a step the user cannot view', async () => {
    await expect(
      readFailedStep(userWithStep(undefined), stepId, {
        appKey: 'm365-excel',
        stepKey: 'createTableRow',
      }),
    ).resolves.toEqual({ error: 'The step could not be read.' })
  })
})

describe('updateFailedStepParameters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates the failed step without accepting another target', async () => {
    mocks.updateStepParametersService.mockResolvedValue({
      step: {
        parameters: {
          columnValues: { Name: '{{trigger.fullName}}' },
          secretKey: 'do-not-leak',
        },
      },
    })
    const user = userWithStep(savedStep)

    await expect(
      updateFailedStepParameters(
        user,
        stepId,
        { appKey: 'm365-excel', stepKey: 'createTableRow' },
        { columnValues: { Name: '{{trigger.fullName}}' } },
        'trace-1',
      ),
    ).resolves.toEqual({ updated: true })

    expect(mocks.updateStepParametersService).toHaveBeenCalledWith({
      user,
      pipeId: savedStep.flowId,
      stepId,
      parameters: { columnValues: { Name: '{{trigger.fullName}}' } },
      traceId: 'trace-1',
    })
  })

  it('does not update protected values', async () => {
    await expect(
      updateFailedStepParameters(
        userWithStep(savedStep),
        stepId,
        { appKey: 'm365-excel', stepKey: 'createTableRow' },
        { secretKey: 'replacement' },
        'trace-1',
      ),
    ).resolves.toEqual({
      error: 'AI cannot safely update a field with protected values.',
    })

    expect(mocks.updateStepParametersService).not.toHaveBeenCalled()
  })
})

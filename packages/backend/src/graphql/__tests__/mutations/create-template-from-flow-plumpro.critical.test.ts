// Business rule: "Convert to template" should only be available to PlumPros.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn(),
  withAccessibleFlows: vi.fn(),
}))
vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

import { ForbiddenError } from '@/errors/graphql-errors'
import createTemplateFromFlow from '@/graphql/mutations/create-template-from-flow'
import type Context from '@/types/express/context'

const context = {
  currentUser: {
    email: 'user@open.gov.sg',
    withAccessibleFlows: mocks.withAccessibleFlows,
  },
} as unknown as Context

async function convert() {
  return createTemplateFromFlow(
    {},
    { input: { flowId: '11111111-1111-4111-8111-111111111111' } },
    context,
    null,
  )
}

describe('createTemplateFromFlow PlumPro access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('checks the plumpro flag for the current user, defaulting to off', async () => {
    mocks.getLdFlagValue.mockResolvedValue(false)

    await expect(convert()).rejects.toThrow()

    expect(mocks.getLdFlagValue).toHaveBeenCalledWith(
      'plumpro',
      'user@open.gov.sg',
      false,
    )
  })

  it('rejects users who are not PlumPros before reading the pipe', async () => {
    mocks.getLdFlagValue.mockResolvedValue(false)

    await expect(convert()).rejects.toBeInstanceOf(ForbiddenError)
    expect(mocks.withAccessibleFlows).not.toHaveBeenCalled()
  })

  it('lets PlumPros read the pipe', async () => {
    mocks.getLdFlagValue.mockResolvedValue(true)
    mocks.withAccessibleFlows.mockImplementation(() => {
      throw new Error('reached flow lookup')
    })

    await expect(convert()).rejects.toThrow('reached flow lookup')
  })
})

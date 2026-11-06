import type { Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fixStepError: vi.fn(),
  getLdFlagValue: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

vi.mock('@/config/redis', () => ({
  createRedisClient: vi.fn(() => ({})),
  REDIS_DB_INDEX: { RATE_LIMIT: 1 },
}))

vi.mock('@/services/step-error-fix', () => ({
  fixStepError: mocks.fixStepError,
  GuideUnavailableError: class GuideUnavailableError extends Error {
    constructor() {
      super('The Plumber guide is unavailable. Please try again.')
      this.name = 'GuideUnavailableError'
    }
  },
  stepErrorFixRequestSchema: {
    safeParse: (body: unknown) => ({ success: true, data: body }),
  },
}))

import { CHECK_STEP_AI_FIX_FLAG } from '@/config/flags'
import { GuideUnavailableError } from '@/services/step-error-fix'

import { postStepErrorFix } from '../step-error-fix'

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }
}

async function post(body: unknown) {
  const res = makeRes()
  await postStepErrorFix(
    {
      context: { currentUser: { email: 'user@example.gov.sg', id: 'user-1' } },
      body,
    } as never,
    res as unknown as Response,
  )
  return res
}

const validBody = {
  appName: 'Excel',
  appKey: 'm365-excel',
  stepKey: 'createTableRow',
  stepName: 'Create table row',
  errorName: 'Column not found',
}

describe('postStepErrorFix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getLdFlagValue.mockResolvedValue('treatment')
  })

  it('returns 404 and skips the fix for the control variation', async () => {
    mocks.getLdFlagValue.mockResolvedValue('control')

    const res = await post(validBody)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(mocks.fixStepError).not.toHaveBeenCalled()
  })

  it('evaluates the flag for the requesting user', async () => {
    mocks.fixStepError.mockResolvedValue({ fixed: false, summary: 'No fix.' })

    await post(validBody)

    expect(mocks.getLdFlagValue).toHaveBeenCalledWith(
      CHECK_STEP_AI_FIX_FLAG,
      'user@example.gov.sg',
      'control',
    )
  })

  it('returns the fix summary', async () => {
    const data = { fixed: true, summary: 'Updated the column mapping.' }
    mocks.fixStepError.mockResolvedValue(data)

    const res = await post(validBody)

    expect(res.json).toHaveBeenCalledWith({ data })
  })

  it('returns 503 when the guide cannot be reached', async () => {
    mocks.fixStepError.mockRejectedValue(new GuideUnavailableError())

    const res = await post(validBody)

    expect(res.status).toHaveBeenCalledWith(503)
  })
})

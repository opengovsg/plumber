import { IGlobalVariable } from '@plumber/types'

import { AxiosError } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import StepError from '@/errors/step'
import logger from '@/helpers/logger'

import { throwPostmanStepError } from '../../common/throw-errors'

describe('throwPostmanStepError blacklist log', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs flowId with each blacklisted recipient', () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => logger)

    const $ = {
      user: { email: 'owner@open.gov.sg' },
      execution: { id: 'execution-1', testRun: false },
      step: { id: 'step-1' },
      flow: { id: 'flow-1' },
    } as IGlobalVariable

    const error = new HttpError({
      message: 'blacklisted',
      isAxiosError: true,
    } as AxiosError)

    expect(() =>
      throwPostmanStepError({
        $,
        status: 'BLACKLISTED',
        error,
        isPartialSuccess: false,
        blacklistedRecipients: ['blocked@example.com', 'other@example.com'],
        invalidAttachments: [],
        isRetryWithoutAttachments: false,
      }),
    ).toThrow(StepError)

    expect(infoSpy).toHaveBeenCalledTimes(2)
    expect(infoSpy).toHaveBeenNthCalledWith(
      1,
      'Blacklisted recipient for postman email step',
      {
        event: 'postman-step-blacklisted-recipient',
        blacklistedEmail: 'blocked@example.com',
        stepId: 'step-1',
        executionId: 'execution-1',
        flowId: 'flow-1',
      },
    )
    expect(infoSpy).toHaveBeenNthCalledWith(
      2,
      'Blacklisted recipient for postman email step',
      expect.objectContaining({
        blacklistedEmail: 'other@example.com',
        flowId: 'flow-1',
      }),
    )
  })
})

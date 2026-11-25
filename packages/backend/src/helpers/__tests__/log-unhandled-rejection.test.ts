import { afterEach, describe, expect, it, vi } from 'vitest'

import { logUnhandledRejection } from '../log-unhandled-rejection'

const mocks = vi.hoisted(() => ({
  loggerError: vi.fn(),
}))

vi.mock('../logger', () => ({
  default: {
    error: mocks.loggerError,
  },
}))

describe('logUnhandledRejection', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('logs the error name and message', () => {
    logUnhandledRejection(new SyntaxError('Unexpected token'))

    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Server unhandled rejection',
      expect.objectContaining({
        event: 'server-unhandled-rejection',
        errorName: 'SyntaxError',
        errorMessage: 'Unexpected token',
      }),
    )
  })

  it('logs a non-Error reason as a string', () => {
    logUnhandledRejection('boom')

    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Server unhandled rejection',
      expect.objectContaining({
        errorName: undefined,
        errorMessage: 'boom',
      }),
    )
  })
})

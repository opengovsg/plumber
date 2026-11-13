import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  flush: vi.fn(),
  warn: vi.fn(),
  config: { appEnv: 'prod', isDev: false },
}))

vi.mock('@/config/app', () => ({ default: mocks.config }))
vi.mock('@/helpers/ai/posthog-client', () => ({
  posthogClient: { capture: mocks.capture, flush: mocks.flush },
}))
vi.mock('@/helpers/logger', () => ({ default: { warn: mocks.warn } }))

import { captureServerEvent, flushServerEvents } from '../server-events'

const event = {
  distinctId: 'user-1',
  event: 'flow_publish_succeeded',
  properties: { flow_id: 'flow-1' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.config.appEnv = 'prod'
  mocks.config.isDev = false
})

describe('captureServerEvent', () => {
  it.each(['prod', 'staging', 'uat'])(
    'sends the event tagged with environment %s',
    (appEnv) => {
      mocks.config.appEnv = appEnv

      captureServerEvent(event)

      expect(mocks.capture).toHaveBeenCalledWith({
        distinctId: 'user-1',
        event: 'flow_publish_succeeded',
        properties: { flow_id: 'flow-1', environment: appEnv },
      })
    },
  )

  it('sends nothing in development, which tests also run as', () => {
    mocks.config.appEnv = 'development'
    mocks.config.isDev = true

    captureServerEvent(event)

    expect(mocks.capture).not.toHaveBeenCalled()
  })

  it('logs a failed capture instead of throwing', () => {
    mocks.capture.mockImplementation(() => {
      throw new Error('queue full')
    })

    expect(() => captureServerEvent(event)).not.toThrow()
    expect(mocks.warn).toHaveBeenCalledWith(
      'Failed to capture a server event',
      {
        event: 'server-event-capture-failed',
        posthogEvent: 'flow_publish_succeeded',
        error: 'queue full',
      },
    )
  })
})

describe('flushServerEvents', () => {
  it('flushes the client', async () => {
    mocks.flush.mockResolvedValue(undefined)

    await flushServerEvents()

    expect(mocks.flush).toHaveBeenCalledOnce()
  })
})

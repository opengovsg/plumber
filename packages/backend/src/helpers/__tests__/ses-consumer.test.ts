import { readFileSync } from 'fs'
import { resolve } from 'path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  consumerStart: vi.fn(),
  consumerStop: vi.fn(),
  consumerOn: vi.fn(),
  consumerOnce: vi.fn(),
  consumerCreate: vi.fn(),
  processSesEvent: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
  sqsQueueUrl: 'https://sqs.ap-southeast-1.amazonaws.com/123/ses-events',
}))

vi.mock('sqs-consumer', () => ({
  Consumer: {
    create: mocks.consumerCreate.mockImplementation(() => ({
      start: mocks.consumerStart,
      stop: mocks.consumerStop,
      on: mocks.consumerOn,
      once: mocks.consumerOnce,
    })),
  },
}))

vi.mock('@/helpers/process-ses-event', () => ({
  processSesEvent: mocks.processSesEvent,
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    info: mocks.loggerInfo,
    error: mocks.loggerError,
  },
}))

vi.mock('@/config/app', () => ({
  default: {
    ses: {
      get sqsQueueUrl() {
        return mocks.sqsQueueUrl
      },
    },
  },
}))

function loadFixture(name: string): string {
  return readFileSync(
    resolve(__dirname, '../../../ses-test-events', name),
    'utf-8',
  )
}

async function importFresh() {
  vi.resetModules()
  return import('../ses-consumer.js')
}

describe('SES consumer wiring', () => {
  beforeEach(() => {
    mocks.consumerCreate.mockClear()
    mocks.consumerStart.mockClear()
    mocks.consumerStop.mockClear()
    mocks.consumerOn.mockClear()
    mocks.consumerOnce.mockClear()
    mocks.processSesEvent.mockReset()
    mocks.loggerInfo.mockClear()
    mocks.loggerError.mockClear()
    mocks.sqsQueueUrl =
      'https://sqs.ap-southeast-1.amazonaws.com/123/ses-events'
  })

  afterEach(() => {
    // Clear SIGTERM listeners registered by tests so they don't accumulate
    process.removeAllListeners('SIGTERM')
  })

  it('does not start the consumer when SQS_QUEUE_URL is unset', async () => {
    mocks.sqsQueueUrl = ''

    const { startSesConsumer } = await importFresh()
    startSesConsumer()

    expect(mocks.consumerCreate).not.toHaveBeenCalled()
    expect(mocks.consumerStart).not.toHaveBeenCalled()
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('SQS_QUEUE_URL not set'),
    )
  })

  it('starts the consumer when SQS_QUEUE_URL is set', async () => {
    const { startSesConsumer } = await importFresh()
    startSesConsumer()

    expect(mocks.consumerCreate).toHaveBeenCalledTimes(1)
    expect(mocks.consumerStart).toHaveBeenCalledTimes(1)

    const createOptions = mocks.consumerCreate.mock.calls[0][0]
    expect(createOptions.queueUrl).toBe(mocks.sqsQueueUrl)
    expect(createOptions.batchSize).toBe(10)
    expect(createOptions.waitTimeSeconds).toBe(20)
    expect(typeof createOptions.handleMessage).toBe('function')
  })

  it('is idempotent — second call does not re-create the consumer', async () => {
    const { startSesConsumer } = await importFresh()
    startSesConsumer()
    startSesConsumer()

    expect(mocks.consumerCreate).toHaveBeenCalledTimes(1)
    expect(mocks.consumerStart).toHaveBeenCalledTimes(1)
  })

  it('handleMessage parses the body and dispatches to processSesEvent', async () => {
    const { startSesConsumer } = await importFresh()
    startSesConsumer()

    const { handleMessage } = mocks.consumerCreate.mock.calls[0][0]
    const message = {
      MessageId: 'sqs-msg-1',
      Body: loadFixture('ses-bounce-permanent.json'),
    }

    const result = await handleMessage(message)

    expect(mocks.processSesEvent).toHaveBeenCalledTimes(1)
    const call = mocks.processSesEvent.mock.calls[0][0]
    expect(call.sqsMessageId).toBe('sqs-msg-1')
    expect(call.sesEvent.eventType).toBe('Bounce')
    // Returning the message tells sqs-consumer to delete (ack) it
    expect(result).toBe(message)
  })

  it('handleMessage re-throws on poison messages (unparseable body) so SQS redelivers to the DLQ', async () => {
    const { startSesConsumer } = await importFresh()
    startSesConsumer()

    const { handleMessage } = mocks.consumerCreate.mock.calls[0][0]
    const message = {
      MessageId: 'sqs-msg-poison',
      Body: 'not valid json {{{',
    }

    // Throwing nacks the message; SQS redelivers up to MaxReceiveCount, then the
    // queue's redrive policy routes it to the DLQ. It must NOT be ack'd.
    await expect(handleMessage(message)).rejects.toThrow()

    expect(mocks.processSesEvent).not.toHaveBeenCalled()
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse SQS message'),
      expect.objectContaining({
        event: 'ses-poison-message',
        sqsMessageId: 'sqs-msg-poison',
        // full body is logged (not just its length) to aid debugging
        body: 'not valid json {{{',
      }),
    )
  })

  it('handleMessage re-throws on a valid SES event of an unhandled type (rejected by the parser)', async () => {
    const { startSesConsumer } = await importFresh()
    startSesConsumer()

    const { handleMessage } = mocks.consumerCreate.mock.calls[0][0]
    // SNS only subscribes Bounce/Complaint, but if anything else slips through
    // it fails the strict union and is treated as poison.
    const message = {
      MessageId: 'sqs-msg-delivery',
      Body: JSON.stringify({
        Message: JSON.stringify({ eventType: 'Delivery', mail: {} }),
      }),
    }

    await expect(handleMessage(message)).rejects.toThrow()

    expect(mocks.processSesEvent).not.toHaveBeenCalled()
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse SQS message'),
      expect.objectContaining({ event: 'ses-poison-message' }),
    )
  })

  it('handleMessage propagates processSesEvent errors so SQS redelivers', async () => {
    mocks.processSesEvent.mockRejectedValueOnce(new Error('db down'))

    const { startSesConsumer } = await importFresh()
    startSesConsumer()

    const { handleMessage } = mocks.consumerCreate.mock.calls[0][0]
    const message = {
      MessageId: 'sqs-msg-retry',
      Body: loadFixture('ses-bounce-permanent.json'),
    }

    await expect(handleMessage(message)).rejects.toThrow('db down')
  })

  it('stopSesConsumer stops the consumer if it was started', async () => {
    const { startSesConsumer, stopSesConsumer } = await importFresh()
    startSesConsumer()
    stopSesConsumer()

    expect(mocks.consumerStop).toHaveBeenCalledTimes(1)
  })

  it('stopSesConsumer is a no-op if the consumer was never started', async () => {
    mocks.sqsQueueUrl = ''

    const { startSesConsumer, stopSesConsumer } = await importFresh()
    startSesConsumer()
    stopSesConsumer()

    expect(mocks.consumerStop).not.toHaveBeenCalled()
  })

  it('SIGTERM stops the consumer, awaits "stopped", then logs shutdown complete', async () => {
    const { startSesConsumer } = await importFresh()
    startSesConsumer()

    expect(process.listenerCount('SIGTERM')).toBe(1)

    // Fire SIGTERM. shutdownOnSigterm should:
    //   1. register a one-time 'stopped' listener on the consumer
    //   2. call consumer.stop()
    //   3. await the 'stopped' event
    //   4. log 'shutdown complete'
    process.emit('SIGTERM' as never)

    // Let the async handler register its 'stopped' listener and call stop()
    await new Promise((resolve) => setImmediate(resolve))

    expect(mocks.consumerStop).toHaveBeenCalledTimes(1)
    const stoppedCall = mocks.consumerOnce.mock.calls.find(
      ([eventName]) => eventName === 'stopped',
    )
    expect(stoppedCall).toBeDefined()

    // Shutdown is still pending — log should NOT have fired yet
    expect(mocks.loggerInfo).not.toHaveBeenCalledWith(
      expect.stringContaining('shutdown complete'),
    )

    // Resolve the await by invoking the registered listener
    const stoppedListener = stoppedCall![1] as () => void
    stoppedListener()

    // Now the handler can complete and log
    await new Promise((resolve) => setImmediate(resolve))

    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('shutdown complete'),
    )
  })
})

import { readFileSync } from 'fs'
import { resolve } from 'path'

import { Consumer } from 'sqs-consumer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import appConfig from '@/config/app'
import * as processSesEventModule from '@/helpers/process-ses-event'
import { spyOnLogger } from '@/test/spy-on-logger'

const consumerStart = vi.fn()
const consumerStop = vi.fn()
const consumerOn = vi.fn()
const consumerOnce = vi.fn()
const consumerCreate = vi.fn()
const processSesEvent = vi.fn()

let loggerSpies: ReturnType<typeof spyOnLogger>
let sqsQueueUrl = 'https://sqs.ap-southeast-1.amazonaws.com/123/ses-events'
let originalSqsQueueUrl: string | undefined

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
    originalSqsQueueUrl = appConfig.ses.sqsQueueUrl
    appConfig.ses.sqsQueueUrl = sqsQueueUrl

    loggerSpies = spyOnLogger({
      info: vi.fn(),
      error: vi.fn(),
    })

    consumerCreate.mockClear()
    consumerStart.mockClear()
    consumerStop.mockClear()
    consumerOn.mockClear()
    consumerOnce.mockClear()
    processSesEvent.mockReset()

    consumerCreate.mockImplementation(() => ({
      start: consumerStart,
      stop: consumerStop,
      on: consumerOn,
      once: consumerOnce,
    }))
    vi.spyOn(Consumer, 'create').mockImplementation(consumerCreate as never)
    vi.spyOn(processSesEventModule, 'processSesEvent').mockImplementation(
      processSesEvent,
    )

    sqsQueueUrl = 'https://sqs.ap-southeast-1.amazonaws.com/123/ses-events'
    appConfig.ses.sqsQueueUrl = sqsQueueUrl
  })

  afterEach(() => {
    appConfig.ses.sqsQueueUrl = originalSqsQueueUrl
    vi.restoreAllMocks()
    // Clear SIGTERM listeners registered by tests so they don't accumulate
    process.removeAllListeners('SIGTERM')
  })

  it('does not start the consumer when SQS_QUEUE_URL is unset', async () => {
    sqsQueueUrl = ''
    appConfig.ses.sqsQueueUrl = ''

    const { startSesConsumer } = await importFresh()
    startSesConsumer()

    expect(consumerCreate).not.toHaveBeenCalled()
    expect(consumerStart).not.toHaveBeenCalled()
    expect(loggerSpies.info).toHaveBeenCalledWith(
      expect.stringContaining('SQS_QUEUE_URL not set'),
    )
  })

  it('starts the consumer when SQS_QUEUE_URL is set', async () => {
    const { startSesConsumer } = await importFresh()
    startSesConsumer()

    expect(consumerCreate).toHaveBeenCalledTimes(1)
    expect(consumerStart).toHaveBeenCalledTimes(1)

    const createOptions = consumerCreate.mock.calls[0][0]
    expect(createOptions.queueUrl).toBe(sqsQueueUrl)
    expect(createOptions.batchSize).toBe(10)
    expect(createOptions.waitTimeSeconds).toBe(20)
    expect(typeof createOptions.handleMessage).toBe('function')
  })

  it('is idempotent — second call does not re-create the consumer', async () => {
    const { startSesConsumer } = await importFresh()
    startSesConsumer()
    startSesConsumer()

    expect(consumerCreate).toHaveBeenCalledTimes(1)
    expect(consumerStart).toHaveBeenCalledTimes(1)
  })

  it('handleMessage parses the body and dispatches to processSesEvent', async () => {
    const { startSesConsumer } = await importFresh()
    startSesConsumer()

    const { handleMessage } = consumerCreate.mock.calls[0][0]
    const message = {
      MessageId: 'sqs-msg-1',
      Body: loadFixture('ses-bounce-permanent.json'),
    }

    const result = await handleMessage(message)

    expect(processSesEvent).toHaveBeenCalledTimes(1)
    const call = processSesEvent.mock.calls[0][0]
    expect(call.sqsMessageId).toBe('sqs-msg-1')
    expect(call.sesEvent.eventType).toBe('Bounce')
    // Returning the message tells sqs-consumer to delete (ack) it
    expect(result).toBe(message)
  })

  it('handleMessage re-throws on poison messages (unparseable body) so SQS redelivers to the DLQ', async () => {
    const { startSesConsumer } = await importFresh()
    startSesConsumer()

    const { handleMessage } = consumerCreate.mock.calls[0][0]
    const message = {
      MessageId: 'sqs-msg-poison',
      Body: 'not valid json {{{',
    }

    // Throwing nacks the message; SQS redelivers up to MaxReceiveCount, then the
    // queue's redrive policy routes it to the DLQ. It must NOT be ack'd.
    await expect(handleMessage(message)).rejects.toThrow()

    expect(processSesEvent).not.toHaveBeenCalled()
    expect(loggerSpies.error).toHaveBeenCalledWith(
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

    const { handleMessage } = consumerCreate.mock.calls[0][0]
    // SNS only subscribes Bounce/Complaint, but if anything else slips through
    // it fails the strict union and is treated as poison.
    const message = {
      MessageId: 'sqs-msg-delivery',
      Body: JSON.stringify({
        Message: JSON.stringify({ eventType: 'Delivery', mail: {} }),
      }),
    }

    await expect(handleMessage(message)).rejects.toThrow()

    expect(processSesEvent).not.toHaveBeenCalled()
    expect(loggerSpies.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse SQS message'),
      expect.objectContaining({ event: 'ses-poison-message' }),
    )
  })

  it('handleMessage propagates processSesEvent errors so SQS redelivers', async () => {
    processSesEvent.mockRejectedValueOnce(new Error('db down'))

    const { startSesConsumer } = await importFresh()
    startSesConsumer()

    const { handleMessage } = consumerCreate.mock.calls[0][0]
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

    expect(consumerStop).toHaveBeenCalledTimes(1)
  })

  it('stopSesConsumer is a no-op if the consumer was never started', async () => {
    sqsQueueUrl = ''
    appConfig.ses.sqsQueueUrl = ''

    const { startSesConsumer, stopSesConsumer } = await importFresh()
    startSesConsumer()
    stopSesConsumer()

    expect(consumerStop).not.toHaveBeenCalled()
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

    expect(consumerStop).toHaveBeenCalledTimes(1)
    const stoppedCall = consumerOnce.mock.calls.find(
      ([eventName]) => eventName === 'stopped',
    )
    expect(stoppedCall).toBeDefined()

    // Shutdown is still pending — log should NOT have fired yet
    expect(loggerSpies.info).not.toHaveBeenCalledWith(
      expect.stringContaining('shutdown complete'),
    )

    // Resolve the await by invoking the registered listener
    const stoppedListener = stoppedCall![1] as () => void
    stoppedListener()

    // Now the handler can complete and log
    await new Promise((resolve) => setImmediate(resolve))

    expect(loggerSpies.info).toHaveBeenCalledWith(
      expect.stringContaining('shutdown complete'),
    )
  })
})

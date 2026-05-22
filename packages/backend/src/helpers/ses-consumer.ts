import { Message, SQSClient } from '@aws-sdk/client-sqs'
import { Consumer } from 'sqs-consumer'

import appConfig from '@/config/app'
import logger from '@/helpers/logger'
import { processSesEvent } from '@/helpers/process-ses-event'
import { parseSqsMessage } from '@/helpers/ses-event-parser'

let sesConsumer: Consumer | undefined

function extractMessageIds(
  message: Message | Message[] | undefined,
): string[] | undefined {
  if (!message) {
    return undefined
  }
  const ids = (Array.isArray(message) ? message : [message])
    .map((m) => m.MessageId)
    .filter((id): id is string => Boolean(id))
  return ids.length > 0 ? ids : undefined
}

export function startSesConsumer(): void {
  const queueUrl = appConfig.ses.sqsQueueUrl
  if (!queueUrl) {
    logger.info('SQS_QUEUE_URL not set — SES consumer will not start.')
    return
  }
  if (sesConsumer) {
    return
  }

  sesConsumer = Consumer.create({
    queueUrl,
    sqs: new SQSClient({ region: 'ap-southeast-1' }),
    batchSize: 10,
    waitTimeSeconds: 20,
    // visibilityTimeout intentionally unset — owned by SQS queue config in
    // infra. heartbeatInterval would force us to also set visibilityTimeout
    // here (the library validates heartbeat < visibility), and our handler
    // is a single DB upsert that completes well under any sensible default.
    pollingCompleteWaitTimeMs: 10_000,
    // Contract with sqs-consumer:
    //   return message  -> ack & delete
    //   throw           -> nack; SQS redelivers per the queue's MaxReceiveCount
    // Do NOT add a blanket try/catch here — the poison-message branch is
    // the only intentional swallow.
    handleMessage: async (message) => {
      const messageId = message.MessageId ?? 'unknown'

      // Poison-message handling: until the DLQ ships (see ses-migration-plan
      // "Alternatives Considered — DLQ"), catch parse failures and ack the
      // message so it does not redeliver for the full SQS retention window.
      // Switch this to a re-throw once the DLQ is in place.
      let sesEvent
      try {
        sesEvent = parseSqsMessage(message.Body ?? '')
      } catch (parseError) {
        logger.error('Failed to parse SQS message — deleting as poison', {
          event: 'ses-poison-message',
          sqsMessageId: messageId,
          bodyPreview: message.Body?.slice(0, 200),
          err:
            parseError instanceof Error ? parseError.stack : String(parseError),
        })
        return message
      }

      await processSesEvent({ sesEvent, sqsMessageId: messageId })
      return message
    },
  })

  sesConsumer.on('error', (err, message) => {
    logger.error('SES consumer error', {
      event: 'ses-consumer-error',
      sqsMessageIds: extractMessageIds(message),
      err: err.stack,
    })
  })

  sesConsumer.on('processing_error', (err, message) => {
    logger.error(
      'SES consumer processing error — message will be redelivered',
      {
        event: 'ses-consumer-processing-error',
        sqsMessageIds: extractMessageIds(message),
        err: err.stack,
      },
    )
  })

  sesConsumer.on('stopped', () => {
    logger.info('SES consumer stopped')
  })

  sesConsumer.start()
  logger.info('SES consumer started', { queueUrl })

  process.once('SIGTERM', shutdownOnSigterm)
}

export function stopSesConsumer(): void {
  sesConsumer?.stop()
}

async function shutdownOnSigterm(): Promise<void> {
  if (!sesConsumer) {
    return
  }
  const consumer = sesConsumer
  const stopped = new Promise<void>((resolve) => {
    consumer.once('stopped', () => resolve())
  })
  consumer.stop()
  // pollingCompleteWaitTimeMs (set at Consumer.create) caps this wait
  // internally, so we do not need an external timeout race here.
  await stopped
  logger.info('SES consumer shutdown complete (SIGTERM)')
}

import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs'
import { QueuePro } from '@taskforcesh/bullmq-pro'

import appConfig from '@/config/app'
import { createRedisClient } from '@/config/redis'
import logger from '@/helpers/logger'
import { parseSqsMessage } from '@/helpers/ses-event-parser'

const CONNECTION_REFUSED = 'ECONNREFUSED'

const sesEventsQueue = new QueuePro('ses-events', {
  prefix: '{sesEventsQ}',
  connection: createRedisClient(),
})

sesEventsQueue.on('error', (err) => {
  if ((err as NodeJS.ErrnoException).code === CONNECTION_REFUSED) {
    logger.error('Make sure you have installed Redis and it is running.', err)
    process.exit()
  }
})

let isPolling = false

process.on('SIGTERM', async () => {
  // Stop the poll loop first so no new messages are received while we
  // close the queue. In-flight enqueues finish before sesEventsQueue.close
  // resolves; the long-poll receive call may take up to WaitTimeSeconds
  // to wind down, which is acceptable for graceful shutdown.
  stopSqsPoller()
  await sesEventsQueue.close()
})

export async function startSqsPoller(): Promise<void> {
  const sqsQueueUrl = appConfig.ses.sqsQueueUrl
  if (!sqsQueueUrl) {
    logger.info('SQS_QUEUE_URL not set — SQS poller will not start.')
    return
  }

  if (isPolling) {
    return
  }
  isPolling = true

  const sqsClient = new SQSClient({
    region: 'ap-southeast-1',
  })

  logger.info('SQS poller started', { queueUrl: sqsQueueUrl })

  while (isPolling) {
    try {
      const response = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: sqsQueueUrl,
          WaitTimeSeconds: 20,
          MaxNumberOfMessages: 10,
        }),
      )

      if (!response.Messages?.length) {
        continue
      }

      for (const message of response.Messages) {
        // Parse-stage failures are unrecoverable: malformed JSON or missing
        // body will keep failing on every retry. Delete poison messages so
        // they don't cycle in the queue forever. The enqueue-stage failure
        // path below is different — that one leaves the message visible for
        // SQS to redeliver, since it's likely a transient Redis issue.
        if (!message.Body) {
          logger.error('SQS message missing Body — deleting as poison', {
            event: 'sqs-poison-message',
            messageId: message.MessageId,
          })
          await sqsClient.send(
            new DeleteMessageCommand({
              QueueUrl: sqsQueueUrl,
              ReceiptHandle: message.ReceiptHandle,
            }),
          )
          continue
        }

        let sesEvent
        try {
          sesEvent = parseSqsMessage(message.Body)
        } catch (parseError) {
          logger.error('Failed to parse SQS message — deleting as poison', {
            event: 'sqs-poison-message',
            messageId: message.MessageId,
            bodyPreview: message.Body.slice(0, 200),
            error:
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
          })
          await sqsClient.send(
            new DeleteMessageCommand({
              QueueUrl: sqsQueueUrl,
              ReceiptHandle: message.ReceiptHandle,
            }),
          )
          continue
        }

        try {
          await sesEventsQueue.add(
            `ses-${sesEvent.eventType}-${message.MessageId}`,
            {
              sesEvent,
              sqsMessageId: message.MessageId,
            },
            {
              removeOnComplete: { age: 7 * 24 * 3600, count: 200 },
              removeOnFail: false,
              attempts: 5,
              backoff: {
                type: 'exponential',
                delay: 5000,
              },
            },
          )

          // Only delete after successful BullMQ enqueue
          await sqsClient.send(
            new DeleteMessageCommand({
              QueueUrl: sqsQueueUrl,
              ReceiptHandle: message.ReceiptHandle,
            }),
          )
        } catch (enqueueError) {
          // Transient enqueue failure (e.g. Redis down) — leave in SQS for
          // redelivery after visibility timeout expires.
          logger.error('Failed to enqueue SQS message — leaving in queue', {
            event: 'sqs-enqueue-error',
            messageId: message.MessageId,
            error:
              enqueueError instanceof Error
                ? enqueueError.message
                : String(enqueueError),
          })
        }
      }
    } catch (pollError) {
      // Polling-level failure (e.g. network issue) — back off and retry
      logger.error('SQS polling error', {
        event: 'sqs-poll-error',
        error:
          pollError instanceof Error ? pollError.message : String(pollError),
      })
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
}

export function stopSqsPoller(): void {
  isPolling = false
}

export default sesEventsQueue

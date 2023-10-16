import { SafeParseError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import defineAction from '@/helpers/define-action'

import { sendTransactionalEmails } from '../../common/email-helper'
import {
  transactionalEmailFields,
  transactionalEmailSchema,
} from '../../common/parameters'
import { getRatelimitedRecipientList } from '../../common/rate-limit'

export default defineAction({
  name: 'Send email',
  key: 'sendTransactionalEmail',
  description: "Sends an email using Postman's transactional API.",
  arguments: transactionalEmailFields,

  async run($, metadata) {
    let progress = 0
    if (metadata?.type === 'postman-send-email') {
      progress = metadata.progress
    }
    const { subject, body, destinationEmail, senderName, replyTo } =
      $.step.parameters
    const result = transactionalEmailSchema.safeParse({
      destinationEmail,
      senderName,
      subject,
      body,
      replyTo,
    })

    if (!result.success) {
      throw fromZodError((result as SafeParseError<unknown>).error)
    }
    const { recipients, newProgress } = await getRatelimitedRecipientList(
      result.data.destinationEmail,
      +progress,
    )

    const results = await sendTransactionalEmails($.http, recipients, {
      subject: result.data.subject,
      body: result.data.body,
      replyTo: result.data.replyTo,
      senderName: result.data.senderName,
    })

    $.setActionItem({
      raw: {
        status: results.map((result) => result.status),
        recipient: results.map((result) => result.recipient),
        ...results[0]?.params,
      },
    })
    if (newProgress < result.data.destinationEmail.length) {
      return {
        nextStep: {
          command: 'jump-to-step',
          stepId: $.step.id,
        },
        nextStepMetadata: {
          type: 'postman-send-email',
          progress: newProgress,
        },
      }
    }
  },
})

import { SafeParseError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import defineAction from '@/helpers/define-action'
import { getObjectFromS3Id } from '@/helpers/s3'

import { sendTransactionalEmails } from '../../common/email-helper'
import { getRatelimitedRecipientList } from '../../common/rate-limit'

import { fields, schema } from './parameters'

export default defineAction({
  name: 'Send email with attachments',
  key: 'sendEmailWithAttachments',
  description: "Sends an email with attachments (via Postman's API).",
  arguments: fields,
  doesFileProcessing: true,

  async run($, metadata) {
    const progress = metadata?.progress || 0
    const {
      subject,
      body,
      destinationEmail,
      replyTo,
      senderName,
      attachments,
    } = $.step.parameters

    const result = schema.safeParse({
      destinationEmail,
      senderName,
      subject,
      body,
      replyTo,
      attachments,
    })

    if (!result.success) {
      throw fromZodError((result as SafeParseError<unknown>).error)
    }

    const attachmentFiles = await Promise.all(
      result.data.attachments?.map(async (attachment) => {
        const obj = await getObjectFromS3Id(attachment)
        return { fileName: obj.name, data: obj.data }
      }),
    )

    const { recipients, newProgress } = await getRatelimitedRecipientList(
      result.data.destinationEmail,
      +progress,
    )
    const results = await sendTransactionalEmails($.http, recipients, {
      subject: result.data.subject,
      body: result.data.body,
      replyTo: result.data.replyTo,
      senderName: result.data.senderName,
      attachments: attachmentFiles,
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
          progress: newProgress,
        },
      }
    }
  },
})

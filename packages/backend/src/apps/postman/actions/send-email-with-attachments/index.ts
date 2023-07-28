import { SafeParseError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import defineAction from '@/helpers/define-action'
import { getObjectFromS3Id } from '@/helpers/s3'

import { sendTransactionalEmails } from '../../common/send-transactional-emails'

import { fields, schema } from './parameters'

export default defineAction({
  name: 'Send email with attachments',
  key: 'sendEmailWithAttachments',
  description: "Sends an email with attachments (via Postman's API).",
  arguments: fields,
  doesFileProcessing: true,

  async run($) {
    const {
      subject,
      body,
      destinationEmail,
      replyTo,
      senderName,
      fromAddress,
      attachments,
    } = $.step.parameters

    const result = schema.safeParse({
      destinationEmail,
      senderName,
      fromAddress,
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

    const results = await sendTransactionalEmails(
      $.http,
      result.data.destinationEmail,
      {
        subject: result.data.subject,
        body: result.data.body,
        replyTo: result.data.replyTo,
        senderName: result.data.senderName,
        fromAddress: result.data.fromAddress,
        attachments: attachmentFiles,
      },
    )

    $.setActionItem({
      raw: {
        status: results.map((result) => result.status),
        recipient: results.map((result) => result.recipient),
        ...results[0]?.params,
      },
    })
  },
})

import { SafeParseError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import defineAction from '@/helpers/define-action'

import { sendTransactionalEmails } from '../../common/email-helper'
import {
  transactionalEmailFields,
  transactionalEmailSchema,
} from '../../common/parameters'

export default defineAction({
  name: 'Send email',
  key: 'sendTransactionalEmail',
  description: "Sends an email using Postman's transactional API.",
  arguments: transactionalEmailFields,

  async run($) {
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

    const results = await sendTransactionalEmails(
      $.http,
      result.data.destinationEmail,
      {
        subject: result.data.subject,
        body: result.data.body,
        replyTo: result.data.replyTo,
        senderName: result.data.senderName,
      },
    )

    $.setActionItem({
      raw: {
        status: results.map((result) => result.status),
        recipient: results.map((result) => result.recipient),
        ...results[0]?.params,
      },
    })

    return null
  },
})

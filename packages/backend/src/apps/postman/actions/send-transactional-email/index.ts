import { SafeParseError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import defineAction from '@/helpers/define-action'

import { emailSchema } from '../../common/types'

export default defineAction({
  name: 'Send email',
  key: 'sendTransactionalEmail',
  description: "Sends an email using Postman's transactional API.",
  arguments: [
    {
      label: 'Subject',
      key: 'subject',
      type: 'string' as const,
      required: true,
      description: 'Email subject.',
      variables: true,
    },
    {
      label: 'Body',
      key: 'body',
      type: 'string' as const,
      required: true,
      description: 'Email body HTML.',
      variables: true,
    },
    {
      label: 'Recipient Email',
      key: 'destinationEmail',
      type: 'string' as const,
      required: true,
      description: 'Recipient email addresses, comma-separated.',
      variables: true,
    },
    {
      label: 'Reply-To Email',
      key: 'replyTo',
      type: 'string' as const,
      required: false,
      description: 'Reply-to email',
      variables: true,
    },
    {
      label: 'Sender Name',
      key: 'senderName',
      type: 'string' as const,
      required: true,
      description: "Sender name (will appear as '<Name> via Postman').",
      variables: true,
    },
    {
      label: 'Attachments',
      key: 'attachments',
      type: 'multiselect' as const,
      required: false,
      variables: true,
      variableTypes: ['file'],
    },
  ],

  async run($) {
    const requestPath = '/v1/transactional/email/send'
    const { subject, body, destinationEmail, senderName, replyTo } =
      $.step.parameters

    const result = emailSchema.safeParse({
      destinationEmail,
      senderName,
      subject,
      body,
      replyTo,
    })

    if (!result.success) {
      throw fromZodError((result as SafeParseError<unknown>).error)
    }

    const promises = result.data.destinationEmail.map(
      async (recipientEmail) => {
        const response = await $.http.post(requestPath, {
          subject: result.data.subject,
          body: result.data.body,
          recipient: recipientEmail,
          reply_to: result.data.replyTo,
          from: `${result.data.senderName} via Postman<donotreply@mail.postman.gov.sg>`,
        })
        const { status, recipient, params } = response.data
        return { status, recipient, params }
      },
    )

    const results = await Promise.all(promises)

    const statusArray: string[] = []
    const recipientArray: string[] = []
    results.forEach(({ status, recipient }) => {
      statusArray.push(status)
      recipientArray.push(recipient)
    })

    $.setActionItem({
      raw: {
        status: statusArray,
        recipient: recipientArray,
        ...results[0]?.params,
      },
    })
  },
})

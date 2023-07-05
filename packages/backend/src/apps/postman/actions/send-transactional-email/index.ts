import FormData from 'form-data'
import { SafeParseError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import defineAction from '@/helpers/define-action'
import { getObjectFromS3Id } from '@/helpers/plumber-s3'

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
      description:
        "Your recipient will see 'From: [Sender Name] via Postman <donotreply@postman.gov.sg>' in their email, unless sender email (below) is also provided",
      variables: true,
    },
    {
      label: 'Sender Email',
      key: 'senderEmail',
      type: 'string' as const,
      required: false,
      description:
        "This MUST be a Custom From Address configured by the Postman team (see our guide for more info). If you specify this, your recipient will see 'From: [Sender Name] <[Sender Email]>' in their email",
      variables: false,
    },
    {
      label: 'Attachments',
      key: 'attachments',
      type: 'multiselect' as const,
      required: false,
      description: 'To use attachments, you MUST configure a sender email.',
      variables: true,
      variableTypes: ['file'],
    },
  ],

  async run($) {
    const requestPath = '/v1/transactional/email/send'
    const {
      subject,
      body,
      destinationEmail,
      senderName,
      replyTo,
      // Older pipes will not have these new fields.
      attachments = [],
      senderEmail = null,
    } = $.step.parameters

    const result = emailSchema.safeParse({
      destinationEmail,
      senderName,
      senderEmail,
      subject,
      body,
      replyTo,
      attachments,
    })

    if (!result.success) {
      throw fromZodError((result as SafeParseError<unknown>).error)
    }

    const fromEmail = result.data.senderEmail
      ? `${result.data.senderName}<${result.data.senderEmail}>`
      : `${result.data.senderName} via Postman<donotreply@mail.postman.gov.sg>`

    const attachmentFiles = await Promise.all(
      result.data.attachments?.map(getObjectFromS3Id),
    )

    const promises = result.data.destinationEmail.map(
      async (recipientEmail) => {
        const requestData = new FormData()
        requestData.append('subject', result.data.subject)
        requestData.append('body', result.data.body)
        requestData.append('recipient', recipientEmail)
        if (result.data.replyTo) {
          requestData.append('reply_to', result.data.replyTo)
        }
        requestData.append('from', fromEmail)
        for (const file of attachmentFiles) {
          requestData.append('attachments', Buffer.from(file.data), file.name)
        }

        const response = await $.http.post(requestPath, requestData, {
          headers: {
            ...requestData.getHeaders(),
          },
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

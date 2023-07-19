import FormData from 'form-data'
import { SafeParseError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import defineAction from '@/helpers/define-action'
import { getObjectFromS3Id } from '@/helpers/s3'

import { parametersSchema } from './parameters'

export default defineAction({
  name: 'Send email with attachments',
  key: 'sendEmailWithAttachments',
  description: "Sends an email with attachments (via Postman's API).",
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
      variables: true,
    },
    {
      label: 'From Address',
      key: 'fromAddress',
      type: 'string' as const,
      required: true,
      description:
        'This MUST be a custom From Address configured with the Postman team.',
      variables: false,
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
    const {
      subject,
      body,
      destinationEmail,
      replyTo,
      senderName,
      fromAddress,
      attachments,
    } = $.step.parameters

    const result = parametersSchema.safeParse({
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
        requestData.append('from', fromAddress)
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

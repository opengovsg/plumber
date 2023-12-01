import { IJSONArray, IRawAction } from '@plumber/types'

import { SafeParseError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { generateStepError } from '@/helpers/generate-step-error'
import { getObjectFromS3Id } from '@/helpers/s3'
import Step from '@/models/step'

import { sendTransactionalEmails } from '../../common/email-helper'
import { transactionalEmailSchema } from '../../common/parameters'
import { getDefaultReplyTo } from '../../common/parameters-helper'
import { getRatelimitedRecipientList } from '../../common/rate-limit'
import { throwSendEmailError } from '../../common/throw-errors'

// TEMP: fix for backward-compatibility with having variable inside links
const action: IRawAction = {
  name: 'Send email with raw HTML',
  key: 'sendEmailWithOldEditor',
  description:
    "Sends an email using Postman's transactional API with raw HTML body content.",
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
      type: 'string',
      required: true,
      description:
        'Email body HTML. We are upgrading this field to a rich-text field, if you observe any issues while editing your existing pipes, please contact us via support@plumber.gov.sg',
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
      label: 'Attachments',
      key: 'attachments',
      description:
        'Find out more about supported file types [here](https://guide.postman.gov.sg/email-api-guide/programmatic-email-api/send-email-api/attachments#list-of-supported-attachment-file-types).',
      type: 'multiselect' as const,
      required: false,
      variables: true,
      variableTypes: ['file'],
    },
  ],
  doesFileProcessing: (step: Step) => {
    return (
      step.parameters.attachments &&
      (step.parameters.attachments as IJSONArray).length > 0
    )
  },

  async run($, metadata) {
    let progress = 0
    if (metadata?.type === 'postman-send-email') {
      progress = metadata.progress
    }
    const {
      subject,
      body,
      destinationEmail,
      senderName,
      replyTo,
      attachments = [],
    } = $.step.parameters
    const result = transactionalEmailSchema.safeParse({
      destinationEmail,
      senderName,
      subject,
      body,
      replyTo: replyTo || (await getDefaultReplyTo($.flow.id)),
      attachments,
    })

    if (!result.success) {
      const validationError = fromZodError(
        (result as SafeParseError<unknown>).error,
      )

      const fieldName = validationError.details[0].path[0]
      const stepErrorName = validationError.details[0].message
      const isAttachmentNotStoredError =
        fieldName === 'attachments' && stepErrorName.includes('not a S3 ID')
      const stepErrorSolution = isAttachmentNotStoredError
        ? 'This attachment was not stored in the last submission. Please make a new submission with attachments to successfully configure this pipe.'
        : 'Click on set up action and reconfigure the invalid field.'
      throw generateStepError(
        stepErrorName,
        stepErrorSolution,
        $.step.position,
        $.app.name,
      )
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

    let results
    try {
      results = await sendTransactionalEmails($.http, recipients, {
        subject: result.data.subject,
        body: result.data.body,
        replyTo: result.data.replyTo,
        senderName: result.data.senderName,
        attachments: attachmentFiles,
      })
    } catch (err) {
      throwSendEmailError(err, $.step.position, $.app.name)
    }

    const recipientListUptilNow = result.data.destinationEmail.slice(
      0,
      newProgress,
    )
    $.setActionItem({
      raw: {
        // if not accepted, the whole action would have already failed hence we
        // can safely hardcode this here
        status: recipientListUptilNow.map(() => 'ACCEPTED'),
        recipient: result.data.destinationEmail.slice(0, newProgress),
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
}

export default action

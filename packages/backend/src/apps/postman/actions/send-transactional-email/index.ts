import { IJSONArray, IRawAction } from '@plumber/types'

import { SafeParseError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import StepError from '@/errors/step'
import { getObjectFromS3Id } from '@/helpers/s3'
import Step from '@/models/step'

import { sendTransactionalEmails } from '../../common/email-helper'
import {
  transactionalEmailFields,
  transactionalEmailSchema,
} from '../../common/parameters'
import { getDefaultReplyTo } from '../../common/parameters-helper'
import { getRatelimitedRecipientList } from '../../common/rate-limit'
import { throwSendEmailError } from '../../common/throw-errors'

const action: IRawAction = {
  name: 'Send email',
  key: 'sendTransactionalEmail',
  description: 'Sends an email with Postman',
  arguments: transactionalEmailFields,
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

      throw new StepError(
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
        // this is to make sure there's at least some content for every new line
        // so on the email client the new line will have some height and show up
        body: result.data.body.replace(
          /(<p\s?((style=")([a-zA-Z0-9:;.\s()\-,]*)("))?>)\s*(<\/p>)/g,
          '<p style="margin: 0">&nbsp;</p>',
        ),
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

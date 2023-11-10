import { IRawAction } from '@plumber/types'

import { SafeParseError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { generateStepError } from '@/helpers/generate-step-error'
import { getObjectFromS3Id } from '@/helpers/s3'

import { VALIDATION_ERROR_SOLUTION } from '../../common/constants'
import { sendTransactionalEmails } from '../../common/email-helper'
import { getDefaultReplyTo } from '../../common/parameters-helper'
import { getRatelimitedRecipientList } from '../../common/rate-limit'
import { throwSendEmailError } from '../../common/throw-errors'

import { fields, schema } from './parameters'

const action: IRawAction = {
  name: 'Send email with attachments',
  key: 'sendEmailWithAttachments',
  description: "Sends an email with attachments (via Postman's API).",
  arguments: fields,
  doesFileProcessing: true,

  async run($, metadata) {
    let progress = 0
    if (metadata?.type === 'postman-send-email') {
      progress = metadata.progress
    }
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
      replyTo: replyTo || (await getDefaultReplyTo($.flow.id)),
      attachments,
    })

    if (!result.success) {
      const validationError = fromZodError(
        (result as SafeParseError<unknown>).error,
      )

      const stepErrorName = validationError.details[0].message
      throw generateStepError(
        stepErrorName,
        VALIDATION_ERROR_SOLUTION,
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
        recipient: recipientListUptilNow,
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

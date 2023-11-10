import { IRawAction } from '@plumber/types'

import { SafeParseError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { generateStepError } from '@/helpers/generate-step-error'

import { VALIDATION_ERROR_SOLUTION } from '../../common/constants'
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
      replyTo: replyTo || (await getDefaultReplyTo($.flow.id)),
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

import { SafeParseError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import StepError from '@/errors/step'
import defineAction from '@/helpers/define-action'

import { sendTransactionalEmails } from '../../common/email-helper'
import {
  transactionalEmailFields,
  transactionalEmailSchema,
} from '../../common/parameters'
import { getDefaultReplyTo } from '../../common/parameters-helper'
import { getRatelimitedRecipientList } from '../../common/rate-limit'
import { generateStepError } from '@/helpers/generate-step-error'

export default defineAction({
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
      const stepErrorSolution =
        'Click set up action and reconfigure the invalid field.'
      throw generateStepError(
        stepErrorName,
        stepErrorSolution,
        $.step.position,
        $.step.appKey,
      )
    }

    const { recipients, newProgress } = await getRatelimitedRecipientList(
      result.data.destinationEmail,
      +progress,
    )

    const results = await sendTransactionalEmails($.http, recipients, {
      subject: result.data.subject,
      body: result.data.body,
      replyTo: result.data.replyTo,
      senderName: result.data.senderName,
    })

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
})

import { IJSONArray, IRawAction } from '@plumber/types'

import { SafeParseError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import StepError from '@/errors/step'
import logger from '@/helpers/logger'
import { getObjectFromS3Id } from '@/helpers/s3'
import Step from '@/models/step'

import { dataOutSchema } from '../../common/data-out-validator'
import { sendTransactionalEmails } from '../../common/email-helper'
import {
  transactionalEmailFields,
  transactionalEmailSchema,
} from '../../common/parameters'
import { getDefaultReplyTo } from '../../common/parameters-helper'
import { sendBlacklistEmail } from '../../common/send-blacklist-email'
import { throwPostmanStepError } from '../../common/throw-errors'

const action: IRawAction = {
  name: 'Send email',
  key: 'sendTransactionalEmail',
  description: 'Sends an email using Postman',
  arguments: transactionalEmailFields,
  doesFileProcessing: (step: Step) => {
    return (
      step.parameters.attachments &&
      (step.parameters.attachments as IJSONArray).length > 0
    )
  },
  helpMessage: 'Customise how your email looks like in this step.',

  async run($) {
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

    /**
     * TODO: properly handle attachment saving
     */
    const attachmentFiles = await Promise.all(
      result.data.attachments?.map(async (attachment) => {
        const obj = await getObjectFromS3Id(attachment)
        return { fileName: obj.name, data: obj.data }
      }),
    )

    let recipientsToSend = result.data.destinationEmail
    /**
     * Logic to handle retries here:
     * We dont want to send the email to the same recipient again if it has been sent before
     */
    const lastExecutionStep = await $.getLastExecutionStep({
      sameExecution: true,
    })

    /**
     * If dataOut is set and valid, it means the last step was at least successful for one recipient
     */
    const prevDataOutParseResult = dataOutSchema.safeParse(
      lastExecutionStep?.dataOut,
    )
    const isPartialRetry =
      prevDataOutParseResult.success && lastExecutionStep.errorDetails

    if (isPartialRetry) {
      const { status, recipient } = prevDataOutParseResult.data
      recipientsToSend = recipient.filter((_, i) => status[i] !== 'ACCEPTED')
    }

    const { dataOut, error, errorStatus } = await sendTransactionalEmails(
      $.http,
      recipientsToSend,
      {
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
      },
    )

    /**
     * Patch the status of the recipients that were sent in the previous execution
     */
    if (isPartialRetry) {
      const prevDataOut = prevDataOutParseResult.data
      const updatedStatus = prevDataOut.status.map((oldStatus, i) => {
        const correspondingRecipient = prevDataOut.recipient[i]
        if (recipientsToSend.includes(correspondingRecipient)) {
          return dataOut.status[
            recipientsToSend.indexOf(correspondingRecipient)
          ]
        }
        return oldStatus
      })
      dataOut.status = updatedStatus
      dataOut.recipient = prevDataOut.recipient
    }

    /**
     * If at least one succeeds, we will allow the execution step to succeed and execution to continue.
     */
    const hasAtLeastOneSuccess = dataOut.status.some(
      (status) => status === 'ACCEPTED',
    )
    if (hasAtLeastOneSuccess) {
      $.setActionItem({
        raw: {
          ...dataOut,
        },
      })
    }

    const blacklistedRecipients = dataOut.recipient.filter(
      (_, i) => dataOut.status[i] === 'BLACKLISTED',
    )

    /**
     * Send blacklist notification email if any
     */
    if (blacklistedRecipients.length > 0 && !$.execution.testRun) {
      try {
        await sendBlacklistEmail({
          flowId: $.flow.id,
          flowName: $.flow.name,
          userEmail: $.user.email,
          executionId: $.execution.id,
          blacklistedRecipients,
        })
      } catch (e) {
        logger.error(e)
        logger.error({
          message: 'Error sending blacklist email',
          flowId: $.flow.id,
          executionId: $.execution.id,
          blacklistedRecipients,
          error: e,
        })
      }
    }
    /**
     * If there's any rate-limit error, we will throw the rate-limit error
     * else we just throw the first error we encounter
     */
    if (error && errorStatus) {
      throwPostmanStepError({
        $,
        status: errorStatus,
        error,
        isPartialSuccess: hasAtLeastOneSuccess,
        blacklistedRecipients,
      })
    }
  },
}

export default action

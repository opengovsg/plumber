import {
  IGlobalVariable,
  IJSONArray,
  IRawAction,
  TestRunStepMetadata,
} from '@plumber/types'

import { z, ZodSafeParseError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import StepError from '@/errors/step'
import { TableVariableMarker } from '@/helpers/compute-parameters'
import { formatTable } from '@/helpers/format-table-variable'
import logger from '@/helpers/logger'
import { SES_BLOCKED_EXTENSIONS } from '@/helpers/s3'
import Step from '@/models/step'

import { POSTMAN_ACCEPTED_EXTENSIONS } from '../../common/constants'
import { dataOutSchema } from '../../common/data-out-validator'
import {
  resolveSesRouting,
  sendTransactionalEmails,
} from '../../common/email-helper'
import {
  transactionalEmailFields,
  transactionalEmailSchema,
} from '../../common/parameters'
import {
  AttachmentExtensionPolicy,
  filterAttachments,
  getDefaultReplyTo,
} from '../../common/parameters-helper'
import { sendBlacklistEmail } from '../../common/send-blacklist-email'
import { sendInvalidAttachmentsEmail } from '../../common/send-invalid-attachments-email'
import { throwPostmanStepError } from '../../common/throw-errors'

import getDataOutMetadata from './get-data-out-metadata'

const sendEmailTestRunMetadataSchema = z
  .object({ useConfiguredEmails: z.boolean().optional() })
  .default({ useConfiguredEmails: false })
/**
 * Type guard to check if a value is a TableVariableMarker
 */
function isTableMarker(value: unknown): value is TableVariableMarker {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__type' in value &&
    (value as TableVariableMarker).__type === 'table'
  )
}

const action: IRawAction = {
  name: 'Send email',
  key: 'sendTransactionalEmail',
  description: 'Sends an email using Postman',
  arguments: transactionalEmailFields,

  preprocessVariable(key: string, value: unknown) {
    // Handle table variable markers - convert to HTML table
    if (isTableMarker(value)) {
      // Only allow table rendering in the body field
      if (key !== 'body') {
        logger.warn('Table variable used in unsupported field', {
          event: 'table-variable-unsupported-field',
          field: key,
        })
        return ''
      }

      const result = formatTable(value.data, {
        selectedColumnIds: value.selectedColumnIds,
      })

      if (result.success === false) {
        logger.warn('Table variable failed to render', {
          event: 'table-variable-render-failed',
          error: result.error,
          message: result.message,
        })
        return ''
      }

      return result.output
    }

    // FormSG checkbox variables resolve to string[]; join for email fields.
    if (Array.isArray(value)) {
      return value.join(', ')
    }

    // Return unchanged for non-table values
    return value
  },

  doesFileProcessing: (step: Step) => {
    return (
      step.parameters.attachments &&
      (step.parameters.attachments as IJSONArray).length > 0
    )
  },

  getDataOutMetadata,

  async run($) {
    return sendEmail($)
  },

  async testRun($, testRunMetadata) {
    return sendEmail($, testRunMetadata)
  },
}

function getSendEmailParams(
  $: IGlobalVariable,
  testRunMetadata?: TestRunStepMetadata,
) {
  const {
    subject,
    body,
    destinationEmail,
    destinationEmailCc,
    senderName,
    replyTo,
    attachments = [],
  } = $.step.parameters

  // Production runs must always use the configured recipients. `useConfiguredEmails`
  // is only consulted on test runs, where the default is to redirect to the test
  // runner's own email so test sends never spam unrelated configured addresses.
  if (!$.execution.testRun) {
    return {
      subject,
      body,
      destinationEmail,
      destinationEmailCc,
      senderName,
      replyTo,
      attachments,
    }
  }

  const parsed = sendEmailTestRunMetadataSchema.safeParse(testRunMetadata)
  const useConfiguredEmails = parsed.success
    ? parsed.data.useConfiguredEmails ?? false
    : false

  return {
    subject,
    body,
    destinationEmail: useConfiguredEmails ? destinationEmail : $.user.email,
    destinationEmailCc: useConfiguredEmails ? destinationEmailCc : undefined,
    senderName,
    replyTo,
    attachments,
  }
}

async function sendEmail(
  $: IGlobalVariable,
  testRunMetadata?: TestRunStepMetadata,
) {
  const {
    subject,
    body,
    destinationEmail,
    destinationEmailCc,
    senderName,
    replyTo,
    attachments,
  } = getSendEmailParams($, testRunMetadata)

  const result = transactionalEmailSchema.safeParse({
    destinationEmail,
    destinationEmailCc,
    senderName,
    subject,
    body,
    replyTo: replyTo || (await getDefaultReplyTo($.flow.id)),
    attachments,
  })

  if (!result.success) {
    const validationError = fromZodError(
      (result as ZodSafeParseError<unknown>).error,
    )

    const fieldName = validationError.details[0].path[0]
    const stepErrorName = validationError.details[0].message
    const isAttachmentNotStoredError =
      fieldName === 'attachments' && stepErrorName.includes('not a S3 ID')
    const stepErrorSolution = isAttachmentNotStoredError
      ? 'This attachment was not stored in the last submission. Please make a new submission with attachments to successfully configure this pipe.'
      : 'Reconfigure the invalid field and try again.'

    throw new StepError(stepErrorName, stepErrorSolution)
  }

  let recipientsToSend = result.data.destinationEmail
  /**
   * Logic to handle retries here:
   * We dont want to send the email to the same recipient again if it has been sent before
   */
  const lastExecutionStep = await $.getLastExecutionStep({
    sameExecution: true,
    iteration: Number($.metadata?.iteration) || undefined,
  })

  /**
   * If dataOut is set and valid, it means the last step was at least successful for one recipient
   */
  const prevDataOutParseResult = dataOutSchema.safeParse(
    lastExecutionStep?.dataOut,
  )
  const isPartialRetry =
    prevDataOutParseResult.success &&
    lastExecutionStep.errorDetails &&
    // Don't do partial retry in test runs! always send to all recipients
    !$.execution.testRun

  if (isPartialRetry) {
    const { status, recipient } = prevDataOutParseResult.data
    recipientsToSend = recipient.filter((_, i) => status[i] !== 'ACCEPTED')
  }

  // Resolve the transport once, on the configured attachments and the actual
  // send recipients. This single decision drives both the file-type policy (SES
  // accepts everything except its executable block-list; Postman keeps its
  // narrower allow-list) and the send itself, so the transport can't flip if
  // filtering later strips every attachment.
  const useSes = await resolveSesRouting(
    recipientsToSend,
    result.data.attachments.length > 0,
  )
  const extensionPolicy: AttachmentExtensionPolicy = useSes
    ? { mode: 'block', extensions: SES_BLOCKED_EXTENSIONS }
    : { mode: 'allow', extensions: POSTMAN_ACCEPTED_EXTENSIONS }

  const {
    attachmentFiles,
    invalidAttachments,
    submissionId,
    isRetryWithoutAttachments,
  } = await filterAttachments({
    $,
    attachmentsList: result.data.attachments,
    isPartialRetry,
    lastExecutionStep,
    extensionPolicy,
  })

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
      ccList: result.data.destinationEmailCc,
      replyTo: result.data.replyTo,
      senderName: result.data.senderName,
      attachments: attachmentFiles,
    },
    useSes,
  )

  /**
   * Patch the status of the recipients that were sent in the previous execution
   */
  if (isPartialRetry) {
    const prevDataOut = prevDataOutParseResult.data
    const updatedStatus = prevDataOut.status.map((oldStatus, i) => {
      const correspondingRecipient = prevDataOut.recipient[i]
      if (recipientsToSend.includes(correspondingRecipient)) {
        return dataOut.status[recipientsToSend.indexOf(correspondingRecipient)]
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

  const defaultSendEmailParams = {
    flowId: $.flow.id,
    flowName: $.flow.name,
    userEmail: $.user.email,
    executionId: $.execution.id,
  }
  const hasInvalidAttachments = invalidAttachments.length > 0
  const invalidAttachmentParams = {
    hasInvalidAttachments,
    submissionId,
    invalidAttachments,
  }

  /**
   * Send blacklist notification email if any
   * If there are any invalid attachments, it will be included in this email
   */
  if (blacklistedRecipients.length > 0 && !$.execution.testRun) {
    try {
      await sendBlacklistEmail({
        ...defaultSendEmailParams,
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
   * Send invalid attachments notification email
   * Do not send on partial retry as we would have already sent this once with the blacklist email
   * Do not send on retry when removing all attachments
   */
  if (
    hasInvalidAttachments &&
    !isPartialRetry &&
    !$.execution.testRun &&
    !isRetryWithoutAttachments
  ) {
    await sendInvalidAttachmentsEmail({
      ...defaultSendEmailParams,
      ...invalidAttachmentParams,
    })

    logger.warn({
      message: 'Invalid attachments',
      flowId: $.flow.id,
      executionId: $.execution.id,
      invalidAttachments: invalidAttachments.join(', '),
    })
  }
  /**
   * If there's any rate-limit error, we will throw the rate-limit error
   * else we just throw the first error we encounter
   */
  if ((error && errorStatus) || invalidAttachments.length > 0) {
    throwPostmanStepError({
      $,
      status: errorStatus,
      error,
      isPartialSuccess: hasAtLeastOneSuccess || invalidAttachments.length > 0,
      blacklistedRecipients,
      invalidAttachments,
      isRetryWithoutAttachments,
    })
  }
}

export default action

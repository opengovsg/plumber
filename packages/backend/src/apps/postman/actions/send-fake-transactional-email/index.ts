import { IJSONArray, IRawAction } from '@plumber/types'

import axios from 'axios'
import FormData from 'form-data'
import { SafeParseError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import appConfig from '@/config/app'
import StepError from '@/errors/step'
import { getObjectFromS3Id } from '@/helpers/s3'
import Step from '@/models/step'

import {
  transactionalEmailFields,
  transactionalEmailSchema,
} from '../../common/parameters'
import { getDefaultReplyTo } from '../../common/parameters-helper'

const action: IRawAction = {
  name: 'Send FAKE email',
  key: 'sendFakeTransactionalEmail',
  description: 'Sends an email using Postman',
  arguments: transactionalEmailFields,
  doesFileProcessing: (step: Step) => {
    return (
      step.parameters.attachments &&
      (step.parameters.attachments as IJSONArray).length > 0
    )
  },

  async run($) {
    const {
      subject,
      body,
      destinationEmail,
      destinationEmailCc,
      senderName,
      replyTo,
      attachments = [],
    } = $.step.parameters
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
        // We verify the flowId here to ensure that the attachment is from the same flow and not
        // maliciously/ manually injected by another user who does not have access to this attachment
        const obj = await getObjectFromS3Id(
          attachment,
          { flowId: $.flow.id },
          $,
        )
        return { fileName: obj.name, data: obj.data }
      }),
    )

    const recipientsToSend = result.data.destinationEmail

    try {
      // mimic sending email
      const requestData = new FormData()
      requestData.append('subject', result.data.subject)
      requestData.append('body', result.data.body)
      requestData.append('recipient', recipientsToSend[0])
      requestData.append(
        'from',
        `${result.data.senderName} <${appConfig.postman.fromAddress}>`,
      )
      requestData.append('disable_tracking', 'true')

      if (result.data.destinationEmailCc?.length > 0) {
        requestData.append('cc', JSON.stringify(result.data.destinationEmailCc))
      }

      if (result.data.replyTo) {
        requestData.append('reply_to', result.data.replyTo)
      }

      for (const attachment of attachmentFiles ?? []) {
        requestData.append(
          'attachments',
          Buffer.from(attachment.data),
          attachment.fileName,
        )
      }

      const response = await axios.post(
        'https://kqbwrjfognb7gcslkta5dq37py0tswwl.lambda-url.ap-southeast-1.on.aws/',
        requestData,
      )

      $.setActionItem({
        raw: {
          ...response.data,
        },
      })
    } catch (e) {
      throw new StepError(
        'Error sending email',
        e.message,
        $.step.position,
        $.app.name,
      )
    }
  },
}

export default action

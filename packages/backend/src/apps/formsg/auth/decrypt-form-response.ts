import type { IAuth, IGlobalVariable } from '@plumber/types'

import { isFieldResponsesV4 } from '@opengovsg/formsg-sdk/adapters'
import {
  DecryptedAttachments,
  DecryptedContent,
} from '@opengovsg/formsg-sdk/dist/types'

import { sha256Hash } from '@/helpers/crypto'
import logger from '@/helpers/logger'

import { getSdk, parseFormEnv } from '../common/form-env'
import convertTableAnswerArrayToTableObject from '../common/process-table-field'
import type { FormsgPayloadWorkflowContent } from '../common/types'
import { NricFilter } from '../triggers/new-submission/index'

import { computeSubmissionTime } from './helpers/compute-submission-time'
import { processResponsesV3 } from './helpers/process-v3-responses'
import { processResponsesV4 } from './helpers/process-v4-responses'
import storeAttachmentInS3 from './helpers/store-attachment-in-s3'
import { decryptFormAttachmentsV3OrV4 } from './decrypt-form-attachments-v3-or-v4'

const NRIC_VERIFIED_FIELDS = new Set(['sgidUinFin', 'uinFin'])

function processLocalAddress(answerArray: string[]): string[] {
  const answer = [...answerArray]

  // Combine level number and unit number if both exist
  const levelNumber = answer[3]
  const unitNumber = answer[4]
  answer[3] = levelNumber && unitNumber ? `#${levelNumber}-${unitNumber}` : ''
  // Remove element at index 4 since we've combined it with element 3
  answer.splice(4, 1)

  return answer
}

/**
 * Filters NRIC if an NRIC filter was configured for the pipe.
 *
 * @returns
 *   * Null if the field should be removed from the output.
 *   * Appropriately transformed NRIC if an NRIC filter was configured.
 *   * Uppercased NRIC otherwise.
 */
export function filterNric($: IGlobalVariable, value: string): string | null {
  const filterSetting = $.step.parameters.nricFilter

  value = value.toUpperCase()

  if (filterSetting === NricFilter.Remove) {
    return null
  }
  if (filterSetting === NricFilter.Hash) {
    return sha256Hash(value + $.flow.id)
  }
  if (filterSetting === NricFilter.Mask) {
    return 'xxxxx' + value.substring(5)
  }

  return value
}

export async function decryptFormResponse(
  $: IGlobalVariable,
): ReturnType<IAuth['verifyWebhook']> {
  if (!$.request) {
    logger.error('No trigger item provided')
    return { verified: false, internalId: null }
  }

  // Note: this could occur due to pipe transfer since connection becomes null
  if (!$.auth.data) {
    logger.warn('Form is not connected to any pipe after pipe is transferred', {
      event: 'formsg-missing-connection',
      flowId: $.flow.id,
      stepId: $.step.id,
      userId: $.user.id,
    })
    return { verified: false, internalId: null }
  }

  const formSgSdk = getSdk(parseFormEnv($))

  const {
    headers,
    body: { data },
  } = $.request

  try {
    formSgSdk.webhooks.authenticate(
      headers['x-formsg-signature'] as string,
      $.webhookUrl,
    )
  } catch {
    logger.error('Unable to verify formsg signature')
    return { verified: false, internalId: null }
  }

  const formSecretKey = $.auth.data.privateKey as string
  const version = data.version

  const shouldStoreAttachments = $.flow.hasFileProcessingActions
  let submission: DecryptedContent | null = null
  let attachments: DecryptedAttachments | null = null

  if (version >= 3) {
    const decryptedSubmission = formSgSdk.cryptoV3.decrypt(formSecretKey, data)

    // If decryption fails (aka invalid form secret key), return false
    if (decryptedSubmission == null) {
      logger.warn('Unable to decrypt MRF formsg response')
      return { verified: false, internalId: null }
    }

    const rawResponses = decryptedSubmission.responses
    const mappedResponses = isFieldResponsesV4(rawResponses)
      ? await processResponsesV4($, data.formId, rawResponses)
      : // NOTE: V3 will be deprecated soon (tm)
        await processResponsesV3($, data.formId, rawResponses)

    submission = {
      responses: mappedResponses,
      verified: decryptedSubmission.verified,
    }

    // shouldStoreAttachments should only consider steps after the mrf step instead of the whole pipe
    // but leaving it as such for now to avoid complexity
    if (shouldStoreAttachments && data.attachmentDownloadUrls) {
      attachments = await decryptFormAttachmentsV3OrV4(
        formSgSdk,
        decryptedSubmission.submissionSecretKey,
        data.attachmentDownloadUrls,
        mappedResponses,
      )
    }
  } else {
    if (shouldStoreAttachments) {
      const decryptedResponse = await formSgSdk.crypto.decryptWithAttachments(
        formSecretKey,
        data,
      )
      submission = decryptedResponse?.content
      attachments = decryptedResponse?.attachments
    } else {
      submission = formSgSdk.crypto.decrypt(formSecretKey, data)
    }
  }

  // If the decryption failed, submission will be `null`.
  if (submission) {
    const workflowContent: FormsgPayloadWorkflowContent = data.workflowContent

    const parsedData: Record<string, any> = {}

    for (const [index, formField] of submission.responses.entries()) {
      const { _id, ...rest } = formField
      // perform null character sanitisation for all answer fields so that it can be inserted into the DB
      if (rest.answer && typeof rest.answer === 'string') {
        rest.answer = rest.answer.replaceAll('\u0000', '')
      }

      if (rest.answerArray && rest.answerArray.length > 0) {
        // Could be an array of strings (checkbox/address field) or a 2-D array of strings (table field)
        if (
          formField.fieldType === 'table' &&
          Array.isArray(rest.answerArray[0])
        ) {
          rest.answerArray = (rest.answerArray as string[][]).map((row) =>
            row.map((column) => column.replaceAll('\u0000', '')),
          )

          rest.answer = convertTableAnswerArrayToTableObject(
            rest.question,
            rest.answerArray,
          )
        } else {
          rest.answerArray = (rest.answerArray as string[]).map((answer) =>
            typeof answer === 'string'
              ? answer.replaceAll('\u0000', '')
              : answer,
          )
        }
      }

      // delete metadata from fields
      delete rest['isHeader']

      if (rest.fieldType === 'nric' && !!rest.answer) {
        const filteredAnswer = filterNric($, rest.answer)
        if (!filteredAnswer) {
          continue
        }
        rest.answer = filteredAnswer
      }

      if (rest.fieldType === 'attachment' && shouldStoreAttachments) {
        let s3FolderId = data.submissionId
        if (data.workflowContent) {
          // we add a suffix if it's an mrf step to prevent
          // overwriting attachments from previous steps
          s3FolderId += `-${workflowContent.workflowStep}`
        }
        rest.answer = await storeAttachmentInS3(
          $,
          s3FolderId,
          formField,
          attachments,
        )
      }

      if (rest.fieldType === 'address') {
        rest.answerArray = processLocalAddress(rest.answerArray as string[])
      }

      // Add signature status to the response regardless of whether the user has signed or not (optional field)
      if (rest.fieldType === 'signature') {
        const isSignaturePresent = (rest.answerArray as string[])?.length > 0
        rest.answer = isSignaturePresent ? 'Signature captured' : ''
        delete rest.answerArray // we dont need to store it
      }

      // Note: the order may not be sequential; fields (e.g. NRIC) can be
      // omitted from the output.
      // Note: FormSG uses dot notation for field ids for MyInfo children
      // we replace with underscore to avoid issues when using lodash get.
      parsedData[_id.replaceAll('.', '_')] = {
        order: index + 1,
        ...rest,
      }
    }

    // Transform NRIC verified fields according to NRIC filter as well.
    const verifiedSubmitterInfo: Record<string, string> = {}
    if (submission.verified) {
      for (const key of Object.keys(submission.verified)) {
        let value = submission.verified[key]

        // @deprecated: filterNrics not supported new pipes
        if (NRIC_VERIFIED_FIELDS.has(key)) {
          value = filterNric($, value)
          if (!value) {
            continue
          }
        }

        // for backwards compatibility with old forms that were created with sgID authType
        if (
          key === 'uinFin' ||
          key === 'sgidUinFin' ||
          // v3 mrf forms send nric as "uinFin (Step 1)"
          // brackets break the variable regex and is not the same as mock data
          // we need to map it back to uinFin
          key.startsWith('uinFin')
        ) {
          verifiedSubmitterInfo['uinFin'] = value
          verifiedSubmitterInfo['sgidUinFin'] = value
        } else {
          verifiedSubmitterInfo[key] = value
        }
      }
    }

    $.request.body = {
      fields: parsedData,
      submissionId: data.submissionId,
      // submission time is computed based on whether it's an MRF or SRF form
      submissionTime: computeSubmissionTime(data),
      formId: data.formId, // this is used to check if a new form is connected to the formsg step
    }

    if (Object.keys(verifiedSubmitterInfo).length > 0) {
      $.request.body.verifiedSubmitterInfo = verifiedSubmitterInfo
    }

    // FormSG team has no plans to encrypt payment fields; they have told us to
    // directly access the data in the body.
    if (data.paymentContent && Object.keys(data.paymentContent).length > 0) {
      $.request.body.paymentContent = data.paymentContent
    }

    delete $.request.headers
    delete $.request.query

    const internalId = data.submissionId

    /**
     * This means it's the first mrf step and is a new submission
     */
    if (!workflowContent) {
      return { verified: true, internalId }
    }

    $.request.body.workflowContent = workflowContent

    return {
      verified: true,
      internalId,
      isSubtrigger: workflowContent.workflowStep > 0,
      subtriggerData: {
        type: 'mrf',
        mrfStepId: workflowContent.workflow[workflowContent.workflowStep]?._id,
      },
    }
  } else {
    // Could not decrypt the submission
    logger.warn('Unable to decrypt formsg response')
    return { verified: false, internalId: null }
  }
}

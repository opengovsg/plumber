import { IGlobalVariable } from '@plumber/types'

import {
  DecryptedAttachments,
  DecryptedContent,
} from '@opengovsg/formsg-sdk/dist/types'
import { DateTime } from 'luxon'

import { sha256Hash } from '@/helpers/crypto'
import logger from '@/helpers/logger'

import { getSdk, parseFormEnv } from '../common/form-env'
import { NricFilter } from '../triggers/new-submission/index'

import storeAttachmentInS3 from './helpers/store-attachment-in-s3'

const NRIC_VERIFIED_FIELDS = new Set(['sgidUinFin', 'uinFin'])

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
): Promise<boolean> {
  if (!$.request) {
    logger.error('No trigger item provided')
    return false
  }

  const formEnv = parseFormEnv($)
  const formSgSdk = getSdk(formEnv)

  const {
    headers,
    body: { data },
  } = $.request

  try {
    formSgSdk.webhooks.authenticate(
      headers['x-formsg-signature'] as string,
      $.webhookUrl,
    )
  } catch (e) {
    logger.error('Unable to verify formsg signature')
    return false
  }

  // Note: this could occur due to pipe transfer since connection becomes null
  if (!$.auth.data) {
    logger.warn('Form is not connected to any pipe after pipe is transferred', {
      event: 'formsg-missing-connection',
      flowId: $.flow.id,
      stepId: $.step.id,
      userId: $.user.id,
    })
    return false
  }

  const formSecretKey = $.auth.data.privateKey as string

  const shouldStoreAttachments = $.flow.hasFileProcessingActions
  let submission: DecryptedContent | null = null
  let attachments: DecryptedAttachments | null = null

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

  // If the decryption failed, submission will be `null`.
  if (submission) {
    const parsedData: Record<string, any> = {}

    for (const [index, formField] of submission.responses.entries()) {
      const { _id, ...rest } = formField

      if (rest.fieldType === 'nric' && !!rest.answer) {
        const filteredAnswer = filterNric($, rest.answer)
        if (!filteredAnswer) {
          continue
        }
        rest.answer = filteredAnswer
      }

      if (rest.fieldType === 'attachment' && shouldStoreAttachments) {
        rest.answer = await storeAttachmentInS3(
          $,
          data.submissionId,
          formField,
          attachments,
        )
      }

      // Note: the order may not be sequential; fields (e.g. NRIC) can be
      // omitted from the output.
      parsedData[_id] = {
        order: index + 1,
        ...rest,
      }
    }

    // Transform NRIC verified fields according to NRIC filter as well.
    const verifiedSubmitterInfo: Record<string, string> = {}
    if (submission.verified) {
      for (const key of Object.keys(submission.verified)) {
        let value = submission.verified[key]

        if (NRIC_VERIFIED_FIELDS.has(key)) {
          value = filterNric($, value)
          if (!value) {
            continue
          }
        }

        verifiedSubmitterInfo[key] = value
      }
    }

    $.request.body = {
      fields: parsedData,
      submissionId: data.submissionId,
      // Forms gives us submission time as ISO 8601 UTC TZ, but our users
      // expect SGT time, so convert it to ISO 8601 SGT TZ (our Luxon is
      // configured for SGT - so although fromISO -> toISO looks like a no-op,
      // it internally does a TZ conversion).
      submissionTime: DateTime.fromISO(data.created).toISO(),
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

    return true
  } else {
    // Could not decrypt the submission
    logger.error('Unable to decrypt formsg response')
    return false
  }
}

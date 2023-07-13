import { IGlobalVariable } from '@plumber/types'

import formsgSdk from '@opengovsg/formsg-sdk'
import { DateTime } from 'luxon'

import { sha256Hash } from '@/helpers/crypto'
import logger from '@/helpers/logger'

import { NricFilter } from '../triggers/new-submission/index'

const formsg = formsgSdk({
  mode: 'production',
})

export async function decryptFormResponse(
  $: IGlobalVariable,
): Promise<boolean> {
  if (!$.request) {
    logger.error('No trigger item provided')
    return false
  }

  const {
    headers,
    body: { data },
  } = $.request

  try {
    formsg.webhooks.authenticate(
      headers['x-formsg-signature'] as string,
      $.webhookUrl,
    )
  } catch (e) {
    logger.error('Unable to verify formsg signature')
    return false
  }

  const formSecretKey = $.auth.data.privateKey as string

  // TODO: deal with attachments
  const submission = formsg.crypto.decrypt(formSecretKey, data)

  // If the decryption failed, submission will be `null`.
  if (submission) {
    const parsedData: Record<string, any> = {}
    const nricFilter = $.step.parameters.nricFilter as string | undefined
    for (const formField of submission.responses) {
      const { _id, ...rest } = formField
      if (rest.fieldType === 'nric' && !!rest.answer) {
        rest.answer = rest.answer.toUpperCase()
        if (nricFilter === NricFilter.Remove) {
          continue
        }
        if (nricFilter === NricFilter.Hash) {
          rest.answer = sha256Hash(rest.answer + $.flow.id)
        }
        if (nricFilter === NricFilter.Mask) {
          rest.answer = 'xxxxx' + rest.answer.substring(5)
        }
      }
      parsedData[_id] = rest
    }

    $.request.body = {
      fields: parsedData,
      submissionId: data.submissionId,
      // Forms gives us submission time as ISO 8601 UTC TZ, but our users
      // expect SGT time, so convert it to ISO 8601 SGT TZ (our Luxon is
      // configured for SGT - so although fromISO -> toISO looks like a no-op,
      // it internally does a TZ conversion).
      submissionTime: DateTime.fromISO(data.created).toISO(),
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

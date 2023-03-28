import { IGlobalVariable } from '@plumber/types'

import formsgSdk from '@opengovsg/formsg-sdk'

import logger from '../../../helpers/logger'

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
    for (const formField of submission.responses) {
      const { _id, ...rest } = formField
      parsedData[_id] = rest
    }

    $.request.body = {
      fields: parsedData,
      submissionId: data.submissionId,
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

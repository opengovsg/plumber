import { IGlobalVariable } from '@plumber/types'

import formsgSdk from '@opengovsg/formsg-sdk'

const formsg = formsgSdk({
  mode: 'production',
})

export async function decryptFormResponse(
  $: IGlobalVariable,
): Promise<boolean> {
  if (!$.request) {
    throw new Error('No trigger item provided')
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
    throw new Error('Unable to verify formsg signature')
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
    throw new Error('Unable to decrypt formsg response')
  }
}

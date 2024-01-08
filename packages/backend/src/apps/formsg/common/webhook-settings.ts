import type {
  IAuth,
  IGlobalVariable,
  IVerifyConnectionRegistrationOutput,
} from '@plumber/types'

import appConfig from '@/config/app'
import HttpError from '@/errors/http'
import logger from '@/helpers/logger'

import { parseFormIdFormat } from '../auth/verify-credentials'

export const FORMSG_WEBHOOK_VERIFICATION_MESSAGE = {
  VERIFIED: 'Your form is connected successfully.',
  ANOTHER_PIPE:
    'The form you are trying to connect is currently being used in another pipe. Continuing with this connection will cause the other pipe to break.',
  ANOTHER_ENDPOINT:
    'The form is currently connected to a different endpoint. Continuing with this connection will override this setting.',
  UNAUTHORIZED:
    "We couldn't verify your form connection. Ensure that you are either the form owner or have been added as an editor.",
  ERROR: "We couldn't verify your form connection. Please try again later.",
}

export const FORMSG_WEBHOOK_REGISTRATION_MESSAGE = {
  UNAUTHORIZED:
    "We couldn't connect your form. Ensure that you are either the form owner or have been added as an editor.",
  ERROR: "We couldn't connect your form. Please try again later.",
}

function getFormDetailsFromGlobalVariable($: IGlobalVariable) {
  const userEmail = $.user?.email
  if (!userEmail) {
    throw new Error('Missing User Email')
  }

  const webhookUrl = $.webhookUrl
  if (!webhookUrl) {
    throw new Error('Webhook URL not instatiated')
  }

  const formId = parseFormIdFormat($)
  if (!formId) {
    throw new Error('Missing Form ID')
  }

  return {
    userEmail,
    webhookUrl,
    formId,
  }
}

export async function registerWebhookUrl(
  $: IGlobalVariable,
): ReturnType<IAuth['registerConnection']> {
  const { userEmail, webhookUrl, formId } = getFormDetailsFromGlobalVariable($)

  try {
    // Set formsg bearer token here
    await $.http.patch(
      `/public/v1/admin/forms/${formId}/settings`,
      {
        webhook: {
          url: webhookUrl,
          isRetryEnabled: true,
        },
        userEmail,
      },
      {
        headers: {
          Authorization: 'Bearer ' + appConfig.formsgApiKey,
        },
      },
    )
  } catch (e: unknown) {
    let error = e
    let errorMsg = FORMSG_WEBHOOK_REGISTRATION_MESSAGE.ERROR
    if (e instanceof HttpError) {
      error = e.response
      // 403 when user email does not have permissions to obtain form settings
      // 422 when user email cannot be retrieved from the database
      if (e.response.status === 403 || e.response.status === 422) {
        errorMsg = FORMSG_WEBHOOK_REGISTRATION_MESSAGE.UNAUTHORIZED
      }
    }
    logger.error('registerWebhookUrl error', {
      userEmail,
      webhookUrl,
      formId,
      error,
    })
    throw new Error(errorMsg)
  }
}

export async function verifyWebhookUrl(
  $: IGlobalVariable,
): Promise<IVerifyConnectionRegistrationOutput> {
  const { userEmail, webhookUrl, formId } = getFormDetailsFromGlobalVariable($)

  try {
    const settings = await $.http.post(
      `/public/v1/admin/forms/${formId}/settings`,
      {
        userEmail,
      },
      {
        headers: {
          Authorization: 'Bearer ' + appConfig.formsgApiKey,
        },
      },
    )
    const currentWebhookUrl = settings.data.webhook.url

    const isWebhookAlreadySet = currentWebhookUrl === webhookUrl
    let message
    if (isWebhookAlreadySet) {
      // webhook is correctly set
      message = FORMSG_WEBHOOK_VERIFICATION_MESSAGE.VERIFIED
    } else if (currentWebhookUrl) {
      // webhook is set but to a different url
      message = FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ANOTHER_ENDPOINT
      if (
        new URL(currentWebhookUrl).hostname
          .toLowerCase()
          .endsWith('plumber.gov.sg')
      ) {
        // webhook is set but to another plumber pipe
        message = FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ANOTHER_PIPE
      }
    }
    return {
      registrationVerified: isWebhookAlreadySet,
      message,
    }
  } catch (e: unknown) {
    let error = e
    let errorMsg = FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ERROR
    if (e instanceof HttpError) {
      error = e.response
      // 403 when user email does not have permissions to obtain form settings
      // 422 when user email cannot be retrieved from the database
      if (e.response.status === 403 || e.response.status === 422) {
        errorMsg = FORMSG_WEBHOOK_VERIFICATION_MESSAGE.UNAUTHORIZED
      }
    }
    logger.error('verifyWebhookUrl error', {
      userEmail,
      webhookUrl,
      formId,
      error,
    })
    return {
      registrationVerified: false,
      message: errorMsg,
    }
  }
}

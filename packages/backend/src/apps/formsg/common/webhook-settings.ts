import {
  IBaseTrigger,
  IGlobalVariable,
  IVerifyHookOutput,
} from '@plumber/types'

import appConfig from '@/config/app'
import HttpError from '@/errors/http'
import logger from '@/helpers/logger'

import { parseFormIdFormat } from '../auth/verify-credentials'

export const FORMSG_WEBHOOK_VERIFICATION_MESSAGE = {
  VERIFIED: 'Your form is connected successfully.',
  EMPTY: 'Click "Connect" to connect your form to this pipe.',
  ANOTHER_PIPE:
    'The form you are trying to connect is currently being used in another pipe. Continuing with this connection will cause the other pipe to break.',
  ANOTHER_ENDPOINT:
    'The form is currently connected to a different endpoint. Continuing with this connection will override this setting.',
  ERROR: "We couldn't verify your webhook settings. Please try again later.",
}

function getFormDetailsFromGlobalVariable($: IGlobalVariable) {
  const userEmail = $.userEmail
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
): ReturnType<IBaseTrigger['registerHook']> {
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
          Authorization: 'Bearer w' + appConfig.formsgApiKey,
        },
      },
    )
  } catch (e) {
    logger.error('Unable to register webhook url', {
      userEmail,
      webhookUrl,
      formId,
      error: (e as HttpError).response,
    })
    throw new Error('Unable to register webhook url')
  }
}

export async function verifyWebhookUrl(
  $: IGlobalVariable,
): Promise<IVerifyHookOutput> {
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
    let message = FORMSG_WEBHOOK_VERIFICATION_MESSAGE.EMPTY
    if (isWebhookAlreadySet) {
      message = FORMSG_WEBHOOK_VERIFICATION_MESSAGE.VERIFIED
    } else if (currentWebhookUrl) {
      message = FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ANOTHER_ENDPOINT
      if (
        new URL(currentWebhookUrl).hostname
          .toLowerCase()
          .endsWith('plumber.gov.sg')
      ) {
        message = FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ANOTHER_PIPE
      }
    }
    return {
      webhookVerified: isWebhookAlreadySet,
      message,
    }
  } catch (e) {
    logger.error('Unable to verify webhook settings', {
      userEmail,
      webhookUrl,
      formId,
      error: (e as HttpError).response,
    })
    return {
      webhookVerified: false,
      message: FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ERROR,
    }
  }
}

import type { IRawAction } from '@plumber/types'

import { DateTime } from 'luxon'

import StepError, { GenericSolution } from '@/errors/step'
import logger from '@/helpers/logger'
import { ensureZodObjectKey, firstZodParseError } from '@/helpers/zod-utils'

import { authDataSchema } from '../../auth/schema'

import getDataOutMetadata from './get-data-out-metadata'
import { fieldSchema, MAX_SMS_CHARS, postmanMessageSchema } from './schema'

const action = {
  name: 'Send SMS',
  key: 'sendSms',
  description: 'Sends an SMS under Gov.SG sender ID',

  /**
   * FEATURE NOTE
   * ---
   * This is a simplified feature where we don't enable users to specify
   * template variables (e.g. via a multi-row)
   *
   * This is because Postman does not provide an API to query template
   * variables, nor template contents (which we can parse). It's more than
   * likely that users will just get confused if we present them with a
   * "Template Variables" multi-select.
   *
   * Instead, for this action, we will instruct users to set up a campaign whose
   * template is just a {{body}} variable. We will provide a more advanced "Send
   * SMS with Variables" action later on, for users who are comfortable working
   * with template variables.
   */
  arguments: [
    {
      label: 'Recipient phone number',
      description: 'Include country code prefix, e.g. +6581237123',
      key: ensureZodObjectKey(fieldSchema, 'recipient'),
      type: 'string' as const,
      required: true,
      variables: true,
    },
    {
      label: 'Message Body',
      description: `This corresponds to {{body}} in your campaign template. Max ${MAX_SMS_CHARS.toLocaleString()} characters`,
      key: ensureZodObjectKey(fieldSchema, 'message'),
      type: 'string' as const,
      required: true,
      variables: true,
    },
  ],

  getDataOutMetadata,

  async run($) {
    const parsedParams = fieldSchema.safeParse($.step.parameters)
    if (parsedParams.success === false) {
      throw new StepError(
        `Configuration problem: ${firstZodParseError(parsedParams.error)}`,
        GenericSolution.ReconfigureInvalidField,
        $.step.position,
        $.app.name,
      )
    }
    const authData = authDataSchema.safeParse($.auth.data)
    if (authData.success === false) {
      throw new StepError(
        `Invalid connection data: ${firstZodParseError(authData.error)}`,
        GenericSolution.MalformedConnectionData,
        $.step.position,
        $.app.name,
      )
    }

    const response = await $.http.post(
      '/campaigns/:campaignId/messages',
      {
        recipient: parsedParams.data.recipient,
        language: 'english',
        values: {
          body: parsedParams.data.message,
        },
      },
      {
        urlPathParams: {
          campaignId: authData.data.campaignId,
        },
      },
    )
    const parsedResponse = postmanMessageSchema.safeParse(response.data)

    if (parsedResponse.success) {
      $.setActionItem({
        raw: {
          message: response.data,
        },
      })

      return
    }

    logger.error('Postman send single SMS response changed', {
      event: 'api-response-change',
      appName: 'postman-sms',
      eventName: 'sendSms',
    })
    $.setActionItem({
      raw: {
        // Signal to the user that an SMS has at least been created by now.
        createdAt: DateTime.now().toISO(),
      },
    })
  },
} satisfies IRawAction

export default action

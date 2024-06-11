import type { IRawAction } from '@plumber/types'

import { DateTime } from 'luxon'
import { ZodError } from 'zod'

import HttpError from '@/errors/http'
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
    try {
      const parsedParams = fieldSchema.parse($.step.parameters)
      const authData = authDataSchema.parse($.auth.data)

      const response = await $.http.post(
        '/campaigns/:campaignId/messages',
        {
          recipient: parsedParams.recipient,
          language: 'english',
          values: {
            body: parsedParams.message,
          },
        },
        {
          urlPathParams: {
            campaignId: authData.campaignId,
          },
        },
      )
      const parsedResponse = postmanMessageSchema.safeParse(response.data)

      if (parsedResponse.success) {
        $.setActionItem({
          raw: {
            message: parsedResponse.data,
          },
        })

        return
      }

      //
      // Edge case: If we're here, then Postman's response has somehow changed
      // without us knowing about it.
      //
      // We'll allow the step to succeed as SMS has already been sent out, but
      // we don't expose any of the response data because we have no clue what
      // it contains now; we don't want to return gibberish to prevent the user
      // into a false sense of correctness.
      //

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
    } catch (error) {
      if (error instanceof ZodError) {
        throw new StepError(
          `Configuration problem: '${firstZodParseError(error)}'`,
          GenericSolution.ReconfigureInvalidField,
          $.step.position,
          $.app.name,
        )
      }

      // This happens if user did not create a template in the format we expect.
      if (
        error instanceof HttpError &&
        error.response.status === 400 &&
        error.response.data.error?.code === 'parameter_invalid'
      ) {
        throw new StepError(
          'Campaign template was not set up correctly',
          'Ensure that you have followed the instructions in our guide to set up your campaign template.',
          $.step.position,
          $.app.name,
        )
      }

      throw new StepError(
        'Error sending SMS',
        error.message,
        $.step.position,
        $.app.name,
      )
    }
  },
} satisfies IRawAction

export default action

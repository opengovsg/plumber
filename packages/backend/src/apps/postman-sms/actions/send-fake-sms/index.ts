import type { IRawAction } from '@plumber/types'

import axios from 'axios'
import { ZodError } from 'zod'

import HttpError from '@/errors/http'
import StepError, { GenericSolution } from '@/errors/step'
import logger from '@/helpers/logger'
import { ensureZodObjectKey, firstZodParseError } from '@/helpers/zod-utils'

import { authDataSchema } from '../../auth/schema'

// import getDataOutMetadata from './send-sms/get-data-out-metadata'
import { fieldSchema, MAX_SMS_CHARS } from './schema'

const action = {
  name: 'Send FAKE SMS',
  key: 'sendFakeSms',
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

  // getDataOutMetadata,

  async run($) {
    try {
      const parsedParams = fieldSchema.parse($.step.parameters)
      const authData = authDataSchema.parse($.auth.data)

      const response = await axios.post(
        'https://kqbwrjfognb7gcslkta5dq37py0tswwl.lambda-url.ap-southeast-1.on.aws/',
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

      logger.error('Postman send single SMS response changed', {
        event: 'api-response-change',
        appName: 'postman-sms',
        eventName: 'sendSms',
      })
      $.setActionItem({
        raw: {
          // Signal to the user that an SMS has at least been created by now.
          ...response.data,
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

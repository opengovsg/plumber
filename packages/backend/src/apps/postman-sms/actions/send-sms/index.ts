import type { IRawAction } from '@plumber/types'

import { DateTime } from 'luxon'
import { ZodError } from 'zod'

import StepError, { GenericSolution } from '@/errors/step'
import logger from '@/helpers/logger'
import { ensureZodObjectKey, firstZodParseError } from '@/helpers/zod-utils'

import { getCampaignForUser } from '../../common/get-campaign-for-user'

import getDataOutMetadata from './get-data-out-metadata'
import { fieldSchema, MAX_SMS_CHARS, postmanMessageSchema } from './schema'

const action = {
  name: 'Send SMS',
  key: 'sendSms',
  description: 'Sends an SMS under Gov.SG sender ID',

  /**
   * CAVEAT
   * ---
   * THIS IS VERY LIKELY TO CHANGE! We currently only allow sending to the only
   * template in Plumber's SMS campaign, using our API key.
   *
   * But in the future, we want to allow users to provide their own API key and
   * specify their own campaigns and templates. We can't do this right now
   * because Postman does not provide an API to query templates / template
   * variables.
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
      label: 'Message',
      description: `Max ${MAX_SMS_CHARS.toLocaleString()} characters`,
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
      const { campaignId = null } = await getCampaignForUser($.user.email)

      if (!campaignId) {
        throw new Error('Your agency is not onboarded to Postman SMS yet.')
      }

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
            campaignId,
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

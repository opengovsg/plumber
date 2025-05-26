import { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import StepError, { GenericSolution } from '@/errors/step'
import Step from '@/models/step'

import {
  DISALLOWED_IP_RESOLVED_ERROR,
  RECURSIVE_WEBHOOK_ERROR_NAME,
} from '../../common/check-urls'
import { CUSTOM_API_TIMEOUT } from '../../common/constants'

import { requestSchema } from './schema'

type TMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

const REDIRECT_STATUS_CODES = [301, 302, 307, 308]

const action: IRawAction = {
  name: 'Make a HTTP request',
  key: 'httpRequest',
  description: 'Makes a custom HTTP request of any method and body',
  arguments: [
    {
      label: 'Method',
      key: 'method',
      type: 'dropdown' as const,
      required: true,
      description: `The HTTP method we'll use to perform the request.`,
      value: 'GET',
      showOptionValue: false,
      options: [
        { label: 'DELETE', value: 'DELETE' },
        { label: 'GET', value: 'GET' },
        { label: 'PATCH', value: 'PATCH' },
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
      ],
    },
    {
      label: 'URL',
      key: 'url',
      type: 'string' as const,
      required: true,
      description:
        'Any URL with a querystring will be re-encoded properly. Plumber URLs (e.g. https://plumber.gov.sg/webhooks/...) are prohibited.',
      variables: true,
    },
    {
      label: 'Custom Headers',
      key: 'customHeaders',
      type: 'multirow-multicol' as const,
      required: false,
      description: 'Add custom headers here.',
      variables: true,
      addRowButtonText: 'Add',
      subFields: [
        {
          placeholder: 'Key',
          key: 'key',
          type: 'string' as const,
          required: true,
          variables: false,
          customStyle: { flex: 2 },
        },
        {
          placeholder: 'Value',
          key: 'value',
          type: 'string' as const,
          required: true,
          variables: true,
          customStyle: { flex: 3, minWidth: 0, maxWidth: '60%' },
        },
      ],
    },
    {
      label: 'Data',
      key: 'data',
      type: 'string' as const,
      required: false,
      description: 'Place raw JSON data here.',
      variables: true,
    },
  ],

  preprocessVariable(parameterKey: string, variableValue: unknown) {
    if (parameterKey === 'data' && typeof variableValue === 'string') {
      // NOTE: this removes the " from the start and end of the string
      // as it is already added in the user input
      return JSON.stringify(variableValue).slice(1, -1)
    }
    return variableValue
  },

  async run($) {
    const method = $.step.parameters.method as TMethod
    const data = $.step.parameters.data as string
    const url = $.step.parameters.url as string

    // Check if the step has an admin override for the timeout
    // There may be certain custom apis that need more time to respond
    // for e.g., Google Apps Script API which can run for up to 360 seconds
    const step = await Step.query().findById($.step.id).throwIfNotFound()
    const customTimeoutRaw = step.config?.adminOverride?.customApiTimeout
    const timeout =
      typeof customTimeoutRaw === 'number'
        ? customTimeoutRaw
        : CUSTOM_API_TIMEOUT

    try {
      const parsedS = requestSchema.parse($.step.parameters)
      const { customHeaders, data: parsedData } = parsedS

      let response = await $.http.request({
        url,
        method,
        data: parsedData,
        maxRedirects: 0,
        headers: customHeaders,
        timeout,
        //  overwriting this to allow redirects to resolve
        validateStatus: (status) =>
          (status >= 200 && status < 300) ||
          REDIRECT_STATUS_CODES.includes(status),
      })

      if (!response) {
        throw new Error('No response returned')
      }

      /**
       * We handle redirects here manually so we could apply the same request interceptors
       * i.e. checking if url is recursive or resolves to internal ip
       * this means that we allow for only one hop of redirect
       */
      if (REDIRECT_STATUS_CODES.includes(response.status)) {
        if (!response.headers?.location) {
          throw new Error('No location header')
        }
        response = await $.http.request({
          url: response.headers.location,
          method:
            response.status === 301 || response.status === 302 ? 'GET' : method,
          data,
          maxRedirects: 0,
        })
      }

      let responseData = response.data

      if (typeof response.data === 'string') {
        responseData = response.data.replaceAll('\u0000', '')
      }

      $.setActionItem({ raw: { data: responseData } })
    } catch (err) {
      if (err instanceof ZodError) {
        const firstError = fromZodError(err).details[0]
        throw new StepError(
          `${firstError.message}`,
          GenericSolution.ReconfigureInvalidField,
          $.step.position,
          $.app.name,
        )
      }

      if (err.message === RECURSIVE_WEBHOOK_ERROR_NAME) {
        throw new StepError(
          RECURSIVE_WEBHOOK_ERROR_NAME,
          'Ensure that you are not redirecting back to a plumber URL.',
          $.step.position,
          $.app.name,
        )
      }

      if (err.message === DISALLOWED_IP_RESOLVED_ERROR) {
        throw new StepError(
          DISALLOWED_IP_RESOLVED_ERROR,
          'If you think this is a mistake, please contact us.',
          $.step.position,
          $.app.name,
        )
      }

      if (err.message === `timeout of ${timeout}ms exceeded`) {
        throw new StepError(
          `HTTP request exceeded timeout of ${timeout / 1000}s`,
          'The request took too long to respond.',
          $.step.position,
          $.app.name,
          err,
        )
      }

      // remaining errors are http errors to be caught
      throw new StepError(
        `Status code: ${
          err.response
            ? `${err.response.status} (${err.response.statusText})`
            : err.message
        } `,
        'Check your custom app based on the status code and retry again.',
        $.step.position,
        $.app.name,
        err,
      )
    }
  },
}

export default action

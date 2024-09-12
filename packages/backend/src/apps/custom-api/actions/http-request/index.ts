import { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'

import {
  DISALLOWED_IP_RESOLVED_ERROR,
  RECURSIVE_WEBHOOK_ERROR_NAME,
} from '../../common/check-urls'

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
      label: 'Data',
      key: 'data',
      type: 'string' as const,
      required: false,
      description: 'Place raw JSON data here.',
      variables: true,
    },
  ],

  async run($) {
    const method = $.step.parameters.method as TMethod
    const data = $.step.parameters.data as string
    const url = $.step.parameters.url as string

    try {
      let response = await $.http.request({
        url,
        method,
        data,
        maxRedirects: 0,
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

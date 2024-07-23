import { IRawAction } from '@plumber/types'

import { URL } from 'url'

import StepError from '@/errors/step'

import { isUrlAllowed } from '../../common/ip-resolver'

type TMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export const RECURSIVE_WEBHOOK_ERROR_NAME =
  'Recursively invoking Plumber webhooks is prohibited.'

const RECURSIVE_WEBHOOK_ERROR_SOLUTION =
  'Ensure that you are not redirecting back to a plumber URL.'

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
        'Any URL with a querystring will be re-encoded properly. Plumber URLs (e.g. https://plumber.gov.sg/webhooks/...) and URLs with redirects (HTTP 301 etc.) are prohibited.',
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

    // Prohibit calling ourselves to prevent self-DoS.
    if (new URL(url).hostname.toLowerCase().endsWith('plumber.gov.sg')) {
      throw new StepError(
        RECURSIVE_WEBHOOK_ERROR_NAME,
        RECURSIVE_WEBHOOK_ERROR_SOLUTION,
        $.step.position,
        $.app.name,
      )
    }

    if (!(await isUrlAllowed(url))) {
      throw new Error('The URL you are trying to call is not allowed.')
    }

    try {
      const response = await $.http.request({
        url,
        method,
        data,
        // there's an internal maxRedirect limit for chrome/safari,
        // so we only block redirect back to plumber urls
        beforeRedirect: (options) => {
          if (options.hostname.toLowerCase().endsWith('plumber.gov.sg')) {
            throw new Error(RECURSIVE_WEBHOOK_ERROR_NAME)
          }
        },
      })

      let responseData = response.data

      if (typeof response.data === 'string') {
        responseData = response.data.replaceAll('\u0000', '')
      }

      $.setActionItem({ raw: { data: responseData } })
    } catch (err) {
      if (err.message === RECURSIVE_WEBHOOK_ERROR_NAME) {
        throw new StepError(
          RECURSIVE_WEBHOOK_ERROR_NAME,
          RECURSIVE_WEBHOOK_ERROR_SOLUTION,
          $.step.position,
          $.app.name,
        )
      }

      // remaining errors are http errors to be caught
      throw new StepError(
        `Status code: ${err.response.status} (${err.response.statusText})`,
        'Check your custom app based on the status code and retry again.',
        $.step.position,
        $.app.name,
        err,
      )
    }
  },
}

export default action

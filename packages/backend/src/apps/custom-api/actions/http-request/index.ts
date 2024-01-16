import { IRawAction } from '@plumber/types'

import { URL } from 'url'

import StepError from '@/errors/step'

import { isUrlAllowed } from '../../common/ip-resolver'

type TMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

const action: IRawAction = {
  name: 'Make a HTTP Request',
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
      throw new Error('Recursively invoking Plumber webhooks is prohibited.')
    }

    if (!(await isUrlAllowed(url))) {
      throw new Error('The URL you are trying to call is not allowed.')
    }

    try {
      const response = await $.http.request({
        url,
        method,
        data,
        // Redirects open up way too many vulns (e.g. someone changes the
        // redirect target to a malicious endpoint), so disable it.
        maxRedirects: 0,
      })

      let responseData = response.data

      if (typeof response.data === 'string') {
        responseData = response.data.replaceAll('\u0000', '')
      }

      $.setActionItem({ raw: { data: responseData } })
    } catch (err) {
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

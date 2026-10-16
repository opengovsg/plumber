import { IGlobalVariable, IRawAction } from '@plumber/types'
import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'

import StepError, { GenericSolution } from '@/errors/step'
import Step from '@/models/step'

import addInterceptors from '../../common/add-interceptors'
import {
  CUSTOM_API_TIMEOUT,
  DISALLOWED_IP_RESOLVED_ERROR,
  INVALID_PROTOCOL_ERROR,
  INVALID_URL_ERROR,
  RECURSIVE_WEBHOOK_ERROR,
} from '../../common/constants'
import { safeAxiosLookup } from '../../common/ip-resolver'
import {
  getStaticSensitiveHeaderKeys,
  SENSITIVE_HEADERS_ERROR,
  SENSITIVE_HEADERS_SOLUTION,
} from '../../common/sensitive-headers'
import { requestSchema } from './schema'

type TMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

const REDIRECT_STATUS_CODES = [301, 302, 307, 308]

async function throwIfStaticSensitiveHeaders($: IGlobalVariable) {
  // Read stored parameters so we can tell static secrets from step variables.
  // By the time testRun/run runs, $.step.parameters is already substituted.
  const step = await Step.query().findById($.step.id).throwIfNotFound()
  const rawHeaders =
    step.parameters?.customHeaders ?? $.step.parameters?.customHeaders
  const sensitiveKeys = getStaticSensitiveHeaderKeys(rawHeaders)

  if (sensitiveKeys.length === 0) {
    return
  }

  const headerList = sensitiveKeys.map((key) => `"${key}"`).join(', ')
  throw new StepError(
    `${SENSITIVE_HEADERS_ERROR}: ${headerList}`,
    SENSITIVE_HEADERS_SOLUTION,
  )
}

async function run($: IGlobalVariable) {
  const method = $.step.parameters.method as TMethod
  const url = $.step.parameters.url as string

  // Check if the step has an admin override for the timeout
  // There may be certain custom apis that need more time to respond
  // for e.g., Google Apps Script API which can run for up to 360 seconds
  const step = await Step.query().findById($.step.id).throwIfNotFound()
  const customTimeoutRaw = step.config?.adminOverride?.customApiTimeout
  const timeout =
    typeof customTimeoutRaw === 'number' ? customTimeoutRaw : CUSTOM_API_TIMEOUT

  try {
    const parsedS = requestSchema.parse($.step.parameters)
    const { customHeaders, data: parsedData } = parsedS

    addInterceptors($.http)

    let response = await $.http.request({
      url,
      method,
      data: parsedData,
      maxRedirects: 0,
      headers: customHeaders,
      // Prevent calling of internal IPs, e.g. aws metadata endpoint
      lookup: safeAxiosLookup,
      timeout,
      //  overwriting this to allow redirects to resolve
      validateStatus: (status: number) =>
        (status >= 200 && status < 300) ||
        REDIRECT_STATUS_CODES.includes(status),
      // stream the response for custom api to protect against gzip bombs
      responseType: 'stream',
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

      // ref: https://github.com/follow-redirects/follow-redirects/blob/21ef28a544c5e57f4c34b8476d75f2144609a1eb/index.js#L442
      // if redirect method is GET, we need to delete the content-type header
      // and drop body
      // technically content-length header should also be dropped, but we dont set it
      // manually
      const redirectMethod =
        response.status === 301 || response.status === 302 ? 'GET' : method

      const redirectHeaders = customHeaders ? { ...customHeaders } : {}
      if (redirectMethod === 'GET' && redirectHeaders) {
        delete redirectHeaders['content-type']
        delete redirectHeaders['Content-Type']
      }

      response = await $.http.request({
        url: response.headers.location,
        method: redirectMethod,
        // Only include data if the redirect method is not GET
        ...(redirectMethod !== 'GET' && { data: parsedData }),
        headers: redirectHeaders,
        timeout,
        // Prevent calling of internal IPs, e.g. aws metadata endpoint
        lookup: safeAxiosLookup,
        maxRedirects: 0,
        // stream the response for custom api to protect against gzip bombs
        responseType: 'stream',
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
      )
    }

    if (err.message === RECURSIVE_WEBHOOK_ERROR) {
      throw new StepError(
        RECURSIVE_WEBHOOK_ERROR,
        'Ensure that you are not redirecting back to a plumber URL.',
      )
    }

    if (
      [
        DISALLOWED_IP_RESOLVED_ERROR,
        INVALID_URL_ERROR,
        INVALID_PROTOCOL_ERROR,
      ].includes(err.message)
    ) {
      throw new StepError(
        err.message,
        'If you think this is a mistake, please contact us.',
      )
    }

    if (err.message === `timeout of ${timeout}ms exceeded`) {
      throw new StepError(
        `HTTP request exceeded timeout of ${timeout / 1000}s`,
        'The request took too long to respond.',
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
      err,
    )
  }
}

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
      // check if the variable is a valid JSON
      if (variableValue.startsWith('{') || variableValue.endsWith('}')) {
        try {
          JSON.parse(variableValue as string)
          // its a valid JSON, don't need to do anything extra
          return variableValue
        } catch {
          // not a valid JSON, remove the " from the start and end of the string
          return JSON.stringify(variableValue).slice(1, -1)
        }
      }
      // NOTE: this removes the " from the start and end of the string
      // as it is already added in the user input
      // when user forms the JSON on the frontend:
      // {"key": "<variable>"}
      return JSON.stringify(variableValue).slice(1, -1)
    }
    return variableValue
  },

  async testRun($) {
    await throwIfStaticSensitiveHeaders($)
    return run($)
  },

  run,
}

export default action

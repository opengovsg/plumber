import { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import createHttpClient from '@/helpers/http-client'

import app from '../..'
import makeRequestAction from '../../actions/http-request'
import {
  DISALLOWED_IP_RESOLVED_ERROR,
  RECURSIVE_WEBHOOK_ERROR_NAME,
} from '../../common/check-urls'

const CF_REDIRECTION_WORKER_FOR_UNIT_TESTS =
  'https://http-request-unit-tester.plumber-wrench.workers.dev'

describe('http request interceptors', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      auth: {
        set: vi.fn(),
        data: {},
      },
      step: {
        id: 'herp-derp',
        appKey: 'webhook',
        position: 2,
        parameters: {
          url: CF_REDIRECTION_WORKER_FOR_UNIT_TESTS,
        },
      },
      setActionItem: vi.fn(),
      app,
    }
    $.http = createHttpClient({
      $,
      baseURL: app.apiBaseUrl,
      beforeRequest: app.beforeRequest ?? [],
      requestErrorHandler: app.requestErrorHandler ?? null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
  it.each([
    'http://staging.plumber.gov.sg/webhooks/abc-def-123',
    'https://www.plumber.gov.sg/webhooks/abc-def-123',
    'https://plumber.gov.sg:443/webhooks/abc-def-123',
    'HTTPS://PLUMBER.GOV.SG/WEBHOOKS/ABC-DEF-123',
    'HtTpS://WwW.PluMbEr.GoV.Sg:443/WeBHoOkS/AbC-DeF-123',
    'http://beta.plumber.gov.sg',
  ])('should prevent recursive URLS', async (url: string) => {
    $.step.parameters.method = 'GET'
    $.step.parameters.url = url
    await expect(makeRequestAction.run($)).rejects.toThrowError(
      RECURSIVE_WEBHOOK_ERROR_NAME,
    )
  })

  it('should allow not recursive URL', async () => {
    $.step.parameters.method = 'GET'
    $.step.parameters.url = 'https://mock.codes/200'
    await expect(makeRequestAction.run($)).resolves.toBeUndefined()
  })

  it.each([
    'http://169.254.170.2/v2/stats',
    'http://169.254.169.254/latest/meta-data/iam/security-credentials',
    'http://localhost:3001',
    'http://127.0.0.1:8080',
    'http://192.168.0.1',
  ])('should prevent internal IPs', async (url: string) => {
    $.step.parameters.method = 'GET'
    $.step.parameters.url = url
    await expect(makeRequestAction.run($)).rejects.toThrowError(
      DISALLOWED_IP_RESOLVED_ERROR,
    )
  })

  it.each([
    'http://74.125.141.101', // google
  ])('should allow external IP', async (ip) => {
    $.step.parameters.method = 'GET'
    $.step.parameters.url = ip
    await expect(makeRequestAction.run($)).resolves.toBeUndefined()
  })

  describe('interceptors should be called when following redirects', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })
    it.each([
      'http://staging.plumber.gov.sg/webhooks/abc-def-123',
      'https://www.plumber.gov.sg/webhooks/abc-def-123',
      'https://plumber.gov.sg:443/webhooks/abc-def-123',
      'HTTPS://PLUMBER.GOV.SG/WEBHOOKS/ABC-DEF-123',
      'HtTpS://WwW.PluMbEr.GoV.Sg:443/WeBHoOkS/AbC-DeF-123',
      'http://beta.plumber.gov.sg',
    ])('should prevent recursive URLS', async (url: string) => {
      $.step.parameters.method = 'GET'
      $.step.parameters.data = JSON.stringify({
        statusCode: 301,
        redirectTo: url,
      })
      await expect(makeRequestAction.run($)).rejects.toThrowError(
        RECURSIVE_WEBHOOK_ERROR_NAME,
      )
    })

    it.each([
      'http://169.254.170.2/v2/stats',
      'http://169.254.169.254/latest/meta-data/iam/security-credentials',
      'http://localhost:3001',
      'http://127.0.0.1:8080',
      'http://192.168.0.1',
    ])('should prevent internal IPs', async (url: string) => {
      $.step.parameters.method = 'POST'
      $.step.parameters.data = JSON.stringify({
        statusCode: 307,
        redirectTo: url,
      })
      await expect(makeRequestAction.run($)).rejects.toThrowError(
        DISALLOWED_IP_RESOLVED_ERROR,
      )
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { IGlobalVariable } from '@/../../types'

import {
  getApiBaseUrl,
  getSdk,
  parseFormEnv,
  parseFormIdAsUrl,
} from '../../common/form-env'

vi.mock('@opengovsg/formsg-sdk', () => ({
  default: vi.fn((opts) => opts.mode),
}))

describe('Form environment handling', () => {
  describe('parseFormIdAsUrl', () => {
    it.each([
      'https://form.gov.sg/topkek',
      'http://localhost:5001/95967305e41b75001293e70c',
      'http://stg.form.gov.sg/hmmm',
      'form.gov.sg/1234',
      'www.form.gov.sg/',
      'uat.form.gov.sg',
      'uat.form.gov.sg/abcd-1234/cup-of-tea',
      'https://stg.form.gov.sg/url%20encoded%20stuff?query=1234',
    ])('returns the URL object for valid URLs (%s)', (rawUrl) => {
      expect(parseFormIdAsUrl(rawUrl)).toBeInstanceOf(URL)
    })

    it.each([
      'https://firm.gov.sg',
      'not a url',
      'httpform.gov.sg',
      '',
      'http://localhost:5000/95967305e41b75001293e70c',
      'http://localhost.evil.test:5001/95967305e41b75001293e70c',
    ])(
      'returns null on invalid URLs (%s)',
      (rawUrl) => {
        expect(parseFormIdAsUrl(rawUrl)).toBeNull()
      },
    )
  })

  describe('parseFormEnv', () => {
    let $: IGlobalVariable

    beforeEach(() => {
      $ = {
        auth: {
          data: {},
        },
      } as unknown as IGlobalVariable
    })

    it.each([
      { formId: '95967305e41b75001293e70c', expectedEnv: 'prod' },
      {
        formId: 'https://form.gov.sg/95967305e41b75001293e70c',
        expectedEnv: 'prod',
      },
      {
        formId: 'https://www.form.gov.sg/95967305e41b75001293e70c',
        expectedEnv: 'prod',
      },
      {
        formId: 'https://stg.form.gov.sg/95967305e41b75001293e70c',
        expectedEnv: 'stg',
      },
      {
        formId: 'https://uat.form.gov.sg/95967305e41b75001293e70c',
        expectedEnv: 'uat',
      },
      {
        formId: 'https://dev.form.gov.sg/95967305e41b75001293e70c',
        expectedEnv: 'dev',
      },
      {
        formId: 'http://localhost:5001/95967305e41b75001293e70c',
        expectedEnv: 'dev',
      },
      {
        formId: 'http://localhost:5001/admin/form/95967305e41b75001293e70c',
        expectedEnv: 'dev',
      },
    ])(
      'returns the appropriate form env when given a valid form ID ($formId = $expectedEnv)',
      ({ formId, expectedEnv }) => {
        $.auth.data.formId = formId
        expect(parseFormEnv($)).toEqual(expectedEnv)
      },
    )

    it.each([
      // Non-string
      { formId: 1234, expectedError: /valid FormSG URL/ },
      // Too short
      { formId: 'asdf', expectedError: /FormSG URL is invalid/ },
      // Invalid FormSG URLs
      { formId: 'not a url', expectedError: /FormSG URL is invalid/ },
      {
        formId: 'http://firm.gov.sg/95967305e41b75001293e70c',
        expectedError: /FormSG URL is invalid/,
      },
      {
        formId: 'httpsform.gov.sg/95967305e41b75001293e70c',
        expectedError: /FormSG URL is invalid/,
      },
      // Unsupported envs
      {
        formId: 'https://some-new-env.form.gov.sg/95967305e41b75001293e70c',
        expectedError: /some-new-env FormSG environment is not supported yet/,
      },
      {
        formId: 'https://uat-2.form.gov.sg/95967305e41b75001293e70c',
        expectedError: /uat-2 FormSG environment is not supported yet/,
      },
    ])(
      'throws appropriate errors when the form id is invalid ($formId)',
      ({ formId, expectedError }) => {
        $.auth.data.formId = formId
        expect(() => parseFormEnv($)).toThrowError(expectedError)
      },
    )
  })

  describe('getApiBaseUrl', () => {
    it.each([
      ['prod', 'https://form.gov.sg/api'],
      ['stg', 'https://stg.form.gov.sg/api'],
      ['uat', 'https://uat.form.gov.sg/api'],
      ['dev', 'http://localhost:5001/api'],
    ] as const)('returns the API URL for %s', (env, expectedUrl) => {
      expect(getApiBaseUrl(env)).toEqual(expectedUrl)
    })
  })

  describe('getSdk', () => {
    // We mock formsgSdk constructor to return the mode, so we just check that.

    it('returns prod sdk if the input environment is prod', () => {
      const sdkMode = getSdk('prod') as unknown as string
      expect(sdkMode).toEqual('production')
    })

    it('returns development sdk if the input environment is dev', () => {
      expect(getSdk('dev')).toEqual('development')
    })

    it.each(['stg', 'uat'] as const)(
      'returns staging sdk if the input environment is $env',
      (env) => {
        const sdkMode = getSdk(env) as unknown as string
        expect(sdkMode).toEqual('staging')
      },
    )
  })
})

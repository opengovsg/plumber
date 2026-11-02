import type { IGlobalVariable } from '@plumber/types'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { beforeEach, describe, expect, it } from 'vitest'

import HttpError from '@/errors/http'
import StepError from '@/errors/step'
import { isRetriableHttpError } from '@/helpers/actions'
import createHttpClient from '@/helpers/http-client'

import app from '../..'
import { getTemplateData } from '../../common/get-template-data'
import requestErrorHandler from '../../common/request-error-handler'

function makeGlobal(
  beforeRequest: Parameters<typeof createHttpClient>[0]['beforeRequest'] = [],
): IGlobalVariable {
  const $ = {
    step: {
      parameters: { templateId: '123', letterParams: [] },
    },
    app,
  } as unknown as IGlobalVariable
  $.http = createHttpClient({
    $,
    baseURL: 'http://localhost/mock-lettersg-api',
    beforeRequest,
    requestErrorHandler,
  })
  return $
}

async function catchStepError(promise: Promise<unknown>): Promise<StepError> {
  const error = await promise.then(
    (): unknown => undefined,
    (err: unknown): unknown => err,
  )
  expect(error).toBeInstanceOf(StepError)
  return error as StepError
}

describe('lettersg requestErrorHandler', () => {
  let $: IGlobalVariable
  let mockAdapter: MockAdapter

  beforeEach(() => {
    $ = makeGlobal()
    mockAdapter = new MockAdapter($.http)
  })

  const createLetter = () => $.http.post('/v1/letters', {})
  const getPdf = () =>
    $.http.get('/v1/letters/:publicId/pdfs', {
      urlPathParams: { publicId: 'abc' },
    })

  it('classifies missing personalised fields as config', async () => {
    mockAdapter.onGet('/v1/templates/123').reply(200, { fields: [] })
    mockAdapter
      .onPost('/v1/letters')
      .reply(400, { message: 'Invalid letter params.' })

    const error = await catchStepError(createLetter())

    expect(error.kind).toBe('config')
    expect(error.message).toContain('Personalised field(s) not specified')
  })

  it('classifies a 404 from creating a letter as config', async () => {
    mockAdapter.onPost('/v1/letters').reply(404, { message: 'Not found' })

    const error = await catchStepError(createLetter())

    expect(error.kind).toBe('config')
    expect(error.cause).toBeUndefined()
  })

  it('classifies a 404 from fetching the template as config', async () => {
    mockAdapter.onGet('/v1/templates/123').reply(404, { message: 'Not found' })

    const error = await catchStepError(getTemplateData($))

    expect(error.kind).toBe('config')
  })

  it('classifies a 404 from fetching the letter PDF as internal', async () => {
    mockAdapter.onGet('/v1/letters/abc/pdfs').reply(404, { message: 'x' })

    const error = await catchStepError(getPdf())

    expect(error.kind).toBe('internal')
    expect(error.cause).toBeInstanceOf(HttpError)
  })

  it.each([400, 401, 403])(
    'classifies an unlisted %i as internal',
    async (status) => {
      mockAdapter.onPost('/v1/letters').reply(status, { message: 'Unknown' })

      const error = await catchStepError(createLetter())

      expect(error.kind).toBe('internal')
      expect(error.cause).toBeInstanceOf(HttpError)
    },
  )

  it('classifies 429 as internal and keeps it retriable', async () => {
    mockAdapter
      .onPost('/v1/letters')
      .reply(429, { message: 'Too many requests' }, { 'retry-after': '10' })

    const error = await catchStepError(createLetter())

    expect(error.kind).toBe('internal')
    expect(isRetriableHttpError(error.cause as HttpError)).toBe(true)
  })

  it.each([502, 503])('classifies %i as third-party', async (status) => {
    mockAdapter.onPost('/v1/letters').reply(status, 'Bad gateway')

    const error = await catchStepError(createLetter())

    expect(error.kind).toBe('third-party')
    expect(error.cause).toBeInstanceOf(HttpError)
  })

  it('classifies 504 as third-party and keeps it retriable', async () => {
    mockAdapter.onPost('/v1/letters').reply(504, 'Gateway timeout')

    const error = await catchStepError(createLetter())

    expect(error.kind).toBe('third-party')
    expect(isRetriableHttpError(error.cause as HttpError)).toBe(true)
  })

  it.each(['ECONNRESET', 'ETIMEDOUT'])(
    'classifies a %s network error as third-party and keeps it retriable',
    async (code) => {
      mockAdapter
        .onPost('/v1/letters')
        .reply((config: InternalAxiosRequestConfig) =>
          Promise.reject(
            AxiosError.from(new Error(`read ${code}`), code, config),
          ),
        )

      const error = await catchStepError(createLetter())

      expect(error.kind).toBe('third-party')
      expect(isRetriableHttpError(error.cause as HttpError)).toBe(true)
    },
  )

  it('classifies a beforeRequest failure as internal', async () => {
    $ = makeGlobal([
      async () => {
        throw new Error('Invalid API key')
      },
    ])

    const error = await catchStepError($.http.post('/v1/letters', {}))

    expect(error.kind).toBe('internal')
  })
})

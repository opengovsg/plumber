import type { IGlobalVariable } from '@plumber/types'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { beforeEach, describe, expect, it } from 'vitest'

import HttpError from '@/errors/http'
import StepError from '@/errors/step'
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

  it.each([
    ['creating a letter', createLetter],
    ['fetching the template', () => getTemplateData($)],
    ['fetching the letter PDF', getPdf],
  ])('classifies a missing template when %s as config', async (_, request) => {
    mockAdapter.onAny().reply(404, {
      message: 'Template not found',
      error: 'Not Found',
      statusCode: 404,
    })

    const error = await catchStepError(request())

    expect(error.kind).toBe('config')
    expect(error.message).toContain('"name":"Template not found"')
    expect(error.cause).toBeUndefined()
  })

  it.each([
    ['a missing letter', getPdf, 'Letter not found'],
    ['an unknown route', createLetter, 'Cannot POST /api/v1/letters'],
  ])('classifies a 404 for %s as internal', async (_, request, message) => {
    mockAdapter.onAny().reply(404, { message })

    const error = await catchStepError(request())

    expect(error.kind).toBe('internal')
    expect(error.cause).toBeInstanceOf(HttpError)
  })

  it('classifies a rejected API key as config', async () => {
    mockAdapter.onPost('/v1/letters').reply(401, {
      statusCode: 401,
      message: 'Unauthorized access. API key not found.',
    })

    const error = await catchStepError(createLetter())

    expect(error.kind).toBe('config')
    expect(error.message).toContain('"name":"Invalid LetterSG API key"')
    expect(error.cause).toBeUndefined()
  })

  it('classifies a deleted LetterSG user as config', async () => {
    mockAdapter.onPost('/v1/letters').reply(403, {
      message: 'Forbidden resource',
      error: 'Forbidden',
      statusCode: 403,
    })

    const error = await catchStepError(createLetter())

    expect(error.kind).toBe('config')
    expect(error.message).toContain('"name":"Invalid LetterSG API key"')
    expect(error.cause).toBeUndefined()
  })

  it.each([
    ['an unlisted 400', 400, { message: 'Unknown' }],
    ['a firewall 403', 403, '<html>Attention Required! | Cloudflare</html>'],
  ])('classifies %s as internal', async (_, status, body) => {
    mockAdapter.onPost('/v1/letters').reply(status, body)

    const error = await catchStepError(createLetter())

    expect(error.kind).toBe('internal')
    expect(error.cause).toBeInstanceOf(HttpError)
  })

  it('classifies 429 as internal and keeps its HttpError cause', async () => {
    mockAdapter
      .onPost('/v1/letters')
      .reply(429, { message: 'Too many requests' }, { 'retry-after': '10' })

    const error = await catchStepError(createLetter())

    expect(error.kind).toBe('internal')
    expect(error.cause).toBeInstanceOf(HttpError)
  })

  it.each([502, 503])('classifies %i as third-party', async (status) => {
    mockAdapter.onPost('/v1/letters').reply(status, 'Bad gateway')

    const error = await catchStepError(createLetter())

    expect(error.kind).toBe('third-party')
    expect(error.cause).toBeInstanceOf(HttpError)
  })

  it('classifies 504 as third-party and keeps its HttpError cause', async () => {
    mockAdapter.onPost('/v1/letters').reply(504, 'Gateway timeout')

    const error = await catchStepError(createLetter())

    expect(error.kind).toBe('third-party')
    expect(error.cause).toBeInstanceOf(HttpError)
  })

  it.each(['ECONNRESET', 'ETIMEDOUT'])(
    'classifies a %s network error as third-party and keeps its HttpError cause',
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
      expect(error.cause).toBeInstanceOf(HttpError)
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

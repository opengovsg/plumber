import type { AxiosError, AxiosResponse } from 'axios'

import HttpError from '@/errors/http'

type HttpErrorOptions = {
  status?: number
  statusText?: string
  data?: unknown
  headers?: AxiosResponse['headers']
  message?: string
  code?: string
}

export function makeHttpError({
  status,
  statusText,
  data,
  headers,
  message,
  code,
}: HttpErrorOptions = {}): HttpError {
  return new HttpError({
    message,
    code,
    response: { status, statusText, data, headers },
  } as AxiosError)
}

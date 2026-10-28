import { IGlobalVariable } from '@plumber/types'

import HttpError from '@/errors/http'

export async function verifyApiKey($: IGlobalVariable): Promise<void> {
  try {
    await $.http.get('/v1/templates?limit=1')
  } catch (err) {
    if (err instanceof HttpError && err.response?.status === 401) {
      throw new Error(
        'API key is invalid, please ensure you have copied the correct API key',
      )
    }
    throw err
  }
}

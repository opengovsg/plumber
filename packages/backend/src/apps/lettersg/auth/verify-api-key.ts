import { IGlobalVariable } from '@plumber/types'

import { getApiBaseUrl } from '../common/api'

export async function verifyApiKey($: IGlobalVariable): Promise<void> {
  const apiKey = $.auth.data.apiKey as string
  const baseUrl = getApiBaseUrl(apiKey)
  const response = await $.http.get('/v1/templates?limit=1', {
    baseURL: baseUrl,
    headers: {
      authorization: `Bearer ${$.auth.data.apiKey}`,
    },
  })

  if (!response?.data?.count) {
    throw new Error('API key is invalid!')
  }
}

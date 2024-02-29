import { IGlobalVariable } from '@plumber/types'

export async function verifyApiKey($: IGlobalVariable): Promise<void> {
  const response = await $.http.get('/v1/templates?limit=1')

  if (!response?.data?.count) {
    throw new Error('API key is invalid!')
  }
}

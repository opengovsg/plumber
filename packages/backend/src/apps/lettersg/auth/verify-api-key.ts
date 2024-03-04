import { IGlobalVariable } from '@plumber/types'

export async function verifyApiKey($: IGlobalVariable): Promise<void> {
  try {
    await $.http.get('/v1/templates?limit=1')
  } catch (err) {
    if (err.response.status === 401) {
      throw new Error(
        'API key is invalid, please ensure you have copied the correct API key',
      )
    }
    throw new Error(
      'Unknown error, please contact support@plumber.gov.sg for more assistance.',
    )
  }
}

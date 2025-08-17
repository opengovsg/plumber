import { IGlobalVariable } from '@plumber/types'

export async function verifyApiKey($: IGlobalVariable): Promise<void> {
  try {
    await $.http.post('/cases/search', {
      page: 1,
      size: 0,
    })
  } catch (err) {
    if (err.response.status === 401) {
      throw new Error(
        'API key is invalid, please ensure you have copied the correct API key',
      )
    }
    throw err
  }
}

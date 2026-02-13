import { IGlobalVariable } from '@plumber/types'

export async function verifyApiKey($: IGlobalVariable): Promise<void> {
  try {
    /**
     * NOTE: this is a hacky way to verify the API key.
     * Calling this API endpoint creates a new chat in the AiBots UI,
     * but this will have to do until there is a proper API endpoint for this.
     */
    await $.http.post(`/chats`, { name: 'Verifiying API Key from Plumber' })
  } catch (err) {
    if (err.response?.status === 401) {
      throw new Error(
        'API key is invalid, please ensure you have entered the correct API key',
      )
    }
    throw err
  }
}

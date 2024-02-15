import type { IGlobalVariable } from '@plumber/types'

export default async function isStillVerified(
  $: IGlobalVariable,
): Promise<boolean> {
  const authData = $.auth.data

  if (!authData || !authData.apiKey) {
    throw new Error('Missing API key')
  }

  // *DOCCENTRAL GUIDE*
  // Perform your API key validation here...
  //
  // if (!isValidDocCentralKey(authData.apiKey)) {
  //   throw new Error('Invalid API key')
  // }

  return true
}

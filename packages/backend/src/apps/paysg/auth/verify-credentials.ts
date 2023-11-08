import type { IGlobalVariable } from '@plumber/types'

export default async function verifyCredentials(
  $: IGlobalVariable,
): Promise<void> {
  if (!$.auth.data?.apiKey) {
    throw new Error('Invalid PaySG API key')
  }
}

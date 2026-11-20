import { PairConnectionError } from './pair-connection-error'

// Local prototype only. Replace with calls to the Pair API once its contract
// is available.
const MOCK_ASSISTANT_NAMES: Record<string, string> = {
  '12345678': 'Leave assistant',
  '87654321': 'Benefits assistant',
}

const RANDOM_ASSISTANT_NAMES = [
  'Procurement assistant',
  'HR policy assistant',
  'IT helpdesk assistant',
  'Finance claims assistant',
  'Onboarding assistant',
  'Travel assistant',
]

const PAIR_UNAVAILABLE_KEY = '00000000'

export const INVALID_KEY_MESSAGE =
  'This API key is not valid. Check the key in Pair and try again.'

// Messages are shown as-is in the connection modal: the first line is the
// headline and later lines are the follow-up.
export const PAIR_UNAVAILABLE_MESSAGE =
  "Can't reach Pair right now.\nYour API key was not saved. Try again in a few minutes."

export const DUPLICATE_ASSISTANT_MESSAGE =
  'You have already added this Pair assistant.\nChoose it from your list instead of adding it again.'

export async function getMockAssistantName(apiKey: string): Promise<string> {
  if (apiKey === PAIR_UNAVAILABLE_KEY) {
    throw new PairConnectionError(PAIR_UNAVAILABLE_MESSAGE)
  }

  // Any other key is accepted. The name derives from the key so that
  // re-verifying the same key returns the same name.
  const hash = [...apiKey].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return (
    MOCK_ASSISTANT_NAMES[apiKey] ??
    RANDOM_ASSISTANT_NAMES[hash % RANDOM_ASSISTANT_NAMES.length]
  )
}

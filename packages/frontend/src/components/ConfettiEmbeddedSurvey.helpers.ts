type SubmitDecision = 'submit' | 'skip' | 'loading'

function decideSubmit({
  isLoaded,
  hasLoadTimedOut,
}: {
  isLoaded: boolean
  hasLoadTimedOut: boolean
}): SubmitDecision {
  if (isLoaded) {
    return 'submit'
  }
  // A survey that never arrives must not strand the user in the builder, but
  // one that is merely slow must not wave them past a required question.
  return hasLoadTimedOut ? 'skip' : 'loading'
}

export function isReadyToSubmit(state: {
  isLoaded: boolean
  hasLoadTimedOut: boolean
}): boolean {
  return decideSubmit(state) !== 'loading'
}

/**
 * Returns whether the user may leave. Confetti's `submit()` refuses a survey
 * with an unanswered required question and shows the errors itself.
 */
export function resolveSubmit({
  isLoaded,
  hasLoadTimedOut,
  submit,
}: {
  isLoaded: boolean
  hasLoadTimedOut: boolean
  submit: (() => boolean) | undefined
}): boolean {
  switch (decideSubmit({ isLoaded, hasLoadTimedOut })) {
    case 'submit':
      return submit?.() ?? false
    case 'skip':
      return true
    case 'loading':
      return false
  }
}

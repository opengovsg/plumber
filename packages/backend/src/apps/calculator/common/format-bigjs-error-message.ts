const BIG_JS_PREFIX = '[big.js] '

// Big.js prefixes their errors with '[big.js] ', let's remove that to
// prevent confusion.
export function formatBigJsErrorMessage(error: Error): string {
  if (!error.message.startsWith(BIG_JS_PREFIX)) {
    return error.message
  }

  return error.message.substring(BIG_JS_PREFIX.length)
}

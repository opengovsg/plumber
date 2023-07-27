import { IGlobalVariable } from '@plumber/types'

const verifyCredentials = async ($: IGlobalVariable) => {
  const stringifiedHeaders = $.auth.data.headers

  let headers: Record<string, string> = {}

  if (stringifiedHeaders && typeof stringifiedHeaders === 'string') {
    headers = stringifiedHeaders
      .split('\n')
      // split by first '='
      .map((header) => header.trim().split('='))
      .reduce((acc, [key, ...value]) => {
        const trimmedKey = key.trim()
        const trimmedValue = value.join('=').trim()
        if (trimmedKey && trimmedValue) {
          acc[trimmedKey] = trimmedValue
          return acc
        } else {
          throw new Error('Malformed headers')
        }
      }, {} as Record<string, string>)
  }

  await $.auth.set({
    headers,
    screenName: $.auth.data.label,
  })
}

export default verifyCredentials

import { IGlobalVariable } from '@plumber/types'

import { getToken } from './get-token'

const verifyCredentials = async ($: IGlobalVariable) => {
  const clientId = $.auth.data.clientId
  const clientSecret = $.auth.data.clientSecret

  if (!clientId || !clientSecret) {
    throw new Error('Missing client ID or client secret')
  }

  try {
    const token = await getToken($)
    if (token) {
      await $.auth.set({
        screenName: $.auth.data.clientId,
      })
    } else {
      throw new Error('Invalid client ID or client secret')
    }
  } catch (error) {
    throw new Error('Invalid client ID or client secret')
  }
}

export default verifyCredentials

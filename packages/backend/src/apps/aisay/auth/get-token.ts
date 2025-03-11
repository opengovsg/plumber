import { IGlobalVariable } from '@plumber/types'

import appConfig from '@/config/app'

export const getToken = async ($: IGlobalVariable) => {
  const getTokenRes = await $.http.request({
    url: appConfig.aisayGetTokenUrl,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${$.auth.data.clientId}:${$.auth.data.clientSecret}`,
      ).toString('base64')}`,
    },
    data: {
      grant_type: 'client_credentials',
      scope: 'aisay-api/query',
      client_id: $.auth.data.clientId,
      client_secret: $.auth.data.clientSecret,
    },
  })

  if (!getTokenRes.data.access_token) {
    throw new Error('Invalid client ID or client secret')
  }

  return getTokenRes.data.access_token
}

import type {
  IField,
  IGlobalVariable,
  IUserAddedConnectionAuth,
} from '@plumber/types'

import qs from 'qs'

const scopes = ['chat:write', 'chat:write.customize', 'chat:write.public']
const userScopes = ['channels:read', 'chat:write', 'search:read', 'users:read']

export default async function generateAuthUrl($: IGlobalVariable) {
  // Our own auth, so safe to cast $.app.auth
  const auth = $.app.auth as IUserAddedConnectionAuth
  const oauthRedirectUrlField = auth.fields?.find(
    (field: IField) => field.key == 'oAuthRedirectUrl',
  )
  if (!oauthRedirectUrlField) {
    throw new Error('oAuthRedirectUrl field not found in Slack app auth')
  }
  const redirectUri = oauthRedirectUrlField.value as string
  const searchParams = qs.stringify({
    client_id: $.auth.data.consumerKey as string,
    redirect_uri: redirectUri,
    scope: scopes.join(','),
    user_scope: userScopes.join(','),
  })

  const url = `${$.app.baseUrl}/oauth/v2/authorize?${searchParams}`

  await $.auth.set({
    url,
  })
}

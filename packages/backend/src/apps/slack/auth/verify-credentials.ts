import type { IGlobalVariable, IUserAddedConnectionAuth } from '@plumber/types'

import getCurrentUser from '../common/get-current-user'

const REQUIRED_USER_SCOPES =
  'channels:read, chat:write, search:read, users:read'

const verifyCredentials = async ($: IGlobalVariable) => {
  // Our own auth, so safe to cast $.app.auth
  const oauthRedirectUrlField = (
    $.app.auth as IUserAddedConnectionAuth
  ).fields.find((field) => field.key == 'oAuthRedirectUrl')
  const redirectUri = oauthRedirectUrlField.value as string
  const params = {
    code: $.auth.data.code,
    client_id: $.auth.data.consumerKey,
    client_secret: $.auth.data.consumerSecret,
    redirect_uri: redirectUri,
  }
  const response = await $.http.post('/oauth.v2.access', null, { params })

  if (response.data.ok === false) {
    throw new Error(
      `Error occurred while verifying credentials: ${response.data.error}. (More info: https://api.slack.com/methods/oauth.v2.access#errors)`,
    )
  }

  const {
    bot_user_id: botId,
    authed_user: { id: userId, access_token: userAccessToken } = {},
    access_token: botAccessToken,
    team: { name: teamName } = {},
  } = response.data

  if (!userAccessToken || !userId) {
    throw new Error(
      `Error occurred while verifying credentials: Slack did not return a user access token. Ensure your Slack app has these user token scopes: ${REQUIRED_USER_SCOPES}.`,
    )
  }

  await $.auth.set({
    botId,
    userId,
    userAccessToken,
    botAccessToken,
    screenName: teamName,
    token: $.auth.data.accessToken,
  })

  const currentUser = await getCurrentUser($)
  const displayName = currentUser.real_name || currentUser.name
  await $.auth.set({
    screenName: displayName ? `${displayName} @ ${teamName}` : teamName,
  })
}

export default verifyCredentials

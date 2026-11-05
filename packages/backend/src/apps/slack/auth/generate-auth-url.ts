import type {
  IField,
  IGlobalVariable,
  IUserAddedConnectionAuth,
} from '@plumber/types'
import qs from 'qs'

import { getLdFlagValue } from '@/helpers/launch-darkly'

const scopes = ['chat:write', 'chat:write.customize', 'chat:write.public']
const userScopes = ['channels:read', 'chat:write', 'users:read']

// Matches the frontend action filter, which hides the action only on `false`.
const FIND_MESSAGE_ACTION_FLAG = 'app_slack_action_findMessage'

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

  const canFindMessage = await getLdFlagValue(
    FIND_MESSAGE_ACTION_FLAG,
    $.user?.email ?? null,
    true,
  )
  const requestedUserScopes = canFindMessage
    ? [...userScopes, 'search:read']
    : userScopes

  const searchParams = qs.stringify({
    client_id: $.auth.data.consumerKey as string,
    redirect_uri: redirectUri,
    scope: scopes.join(','),
    user_scope: requestedUserScopes.join(','),
  })

  const url = `${$.app.baseUrl}/oauth/v2/authorize?${searchParams}`

  await $.auth.set({
    url,
  })
}

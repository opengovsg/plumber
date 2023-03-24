import { IGlobalVariable } from '@plumber/types'

const verifyCredentials = async ($: IGlobalVariable) => {
  await $.http.get('/2010-04-01/Accounts.json?PageSize=1')

  const screenName = $.auth.data.apiKeySid
    ? `API_KEY_${($.auth.data.apiKeySid as string).slice(-8)}`
    : `ACCOUNT_${($.auth.data.accountSid as string).slice(-8)}`

  await $.auth.set({
    screenName,
  })
}

export default verifyCredentials

import { IGlobalVariable } from '@plumber/types'

const verifyCredentials = async ($: IGlobalVariable) => {
  await $.http.get(
    `https://api.twilio.com/2010-04-01/Accounts/${$.auth.data.accountSid}/Applications.json?PageSize=1`,
  )
  if ($.auth.data.apiKeySid) {
    await $.auth.set({
      screenName: `API_KEY_ENDING_WITH_${(
        $.auth.data.apiKeySid as string
      ).slice(-8)}`,
    })
  } else {
    await $.auth.set({
      screenName: `ACCOUNT_SID_ENDING_WITH_${(
        $.auth.data.accountSid as string
      ).slice(-8)}`,
    })
  }
}

export default verifyCredentials

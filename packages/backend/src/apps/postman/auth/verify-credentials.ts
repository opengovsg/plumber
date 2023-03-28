import { IGlobalVariable } from '@plumber/types'

const verifyCredentials = async ($: IGlobalVariable) => {
  await $.http.get('v1/campaigns?limit=1')

  await $.auth.set({
    screenName: $.auth.data.screenName,
  })
}

export default verifyCredentials

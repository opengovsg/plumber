import { IGlobalVariable } from '@plumber/types'

import verifyCredentials from '../../custom-api/auth/verify-credentials'

const isStillVerified = async ($: IGlobalVariable) => {
  await verifyCredentials($)
  return true
}

export default isStillVerified

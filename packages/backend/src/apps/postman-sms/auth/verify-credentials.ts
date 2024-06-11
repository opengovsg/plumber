import type { IGlobalVariable, IUserAddedConnectionAuth } from '@plumber/types'

import { PostmanEnv } from '../common/constants'
import getPostmanEnv from '../common/get-postman-env'

import isStillVerified from './is-still-verified'
import { authDataSchema } from './schema'

const verifyCredentials: IUserAddedConnectionAuth['verifyCredentials'] = async (
  $: IGlobalVariable,
) => {
  const { screenName } = authDataSchema.parse($.auth.data)

  // Prefix label with "[TEST]"" for test environments, unless user has already done it themselves.
  if (
    getPostmanEnv($) === PostmanEnv.Test &&
    !screenName.startsWith('[TEST] ')
  ) {
    await $.auth.set({
      screenName: `[TEST] ${screenName}`,
    })
  }

  // Sanity check before saving.
  await isStillVerified($)
}

export default verifyCredentials

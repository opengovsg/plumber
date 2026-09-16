import type { IGlobalVariable, IUserAddedConnectionAuth } from '@plumber/types'

import { POSTMAN_TEST_LABEL_PREFIX, PostmanEnv } from '../common/constants'
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
    !screenName.startsWith(POSTMAN_TEST_LABEL_PREFIX)
  ) {
    await $.auth.set({
      screenName: `${POSTMAN_TEST_LABEL_PREFIX}${screenName}`,
    })
  }

  // Sanity check before saving.
  await isStillVerified($)
}

export default verifyCredentials

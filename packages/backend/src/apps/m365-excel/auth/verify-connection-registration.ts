import type { IAuth } from '@plumber/types'

import type { AuthData } from '../common/auth-data'

const verifyConnectionRegistration: NonNullable<
  IAuth['verifyConnectionRegistration']
> = async function ($) {
  const authData = $.auth.data as AuthData

  if (authData.folderId) {
    return {
      registrationVerified: true,
      message: `A folder titled ${$.user.email} has been created for you. Place your Excel files inside this folder to use them in your pipe.`,
    }
  }

  return {
    registrationVerified: false,
    message: null,
  }
}

export default verifyConnectionRegistration

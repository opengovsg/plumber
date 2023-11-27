import type { IAuth } from '@plumber/types'

import type { AuthData } from '../common/auth-data'

const verifyConnectionRegistration: NonNullable<
  IAuth['verifyConnectionRegistration']
> = async function ($) {
  const authData = $.auth.data as AuthData

  if (authData.folderId) {
    return {
      registrationVerified: true,
      message: 'Place files in your Plumber folder to begin.',
    }
  }

  return {
    registrationVerified: false,
    message:
      'Press "Connect" to set up Plumber integration with this M365 server',
  }
}

export default verifyConnectionRegistration

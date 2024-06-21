import type { IAuth } from '@plumber/types'

import type { AuthData } from '../common//auth-data'
import { createPlumberFolder } from '../common/create-plumber-folder'
import { RATE_LIMIT_FOR_RELEASE_ONLY_REMOVE_AFTER_JULY_2024 } from '../FOR_RELEASE_PERIOD_ONLY'

const registerConnection: NonNullable<IAuth['registerConnection']> =
  async function ($) {
    const authData = $.auth.data as AuthData

    if (authData.folderId) {
      // No-op, folder already created
      return
    }

    // FOR RELEASE ONLY TO STEM ANY THUNDERING HERDS; REMOVE AFTER 21 Jul 2024.
    await RATE_LIMIT_FOR_RELEASE_ONLY_REMOVE_AFTER_JULY_2024($.user?.email)

    const folderId = await createPlumberFolder(authData.tenantKey, $)
    $.auth.set({
      ...authData,
      folderId,
    })
  }

export default registerConnection

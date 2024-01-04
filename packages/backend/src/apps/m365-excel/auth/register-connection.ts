import type { IAuth } from '@plumber/types'

import type { AuthData } from '../common//auth-data'
import { createPlumberFolder } from '../common/create-plumber-folder'

const registerConnection: NonNullable<IAuth['registerConnection']> =
  async function ($) {
    const authData = $.auth.data as AuthData

    if (authData.folderId) {
      // No-op, folder already created
      return
    }

    const folderId = await createPlumberFolder(authData.tenantKey, $)
    $.auth.set({
      ...authData,
      folderId,
    })
  }

export default registerConnection

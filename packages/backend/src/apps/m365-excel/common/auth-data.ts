import type { IGlobalVariable, IJSONObject } from '@plumber/types'

export interface AuthData extends IJSONObject {
  tenantKey: string
  folderId?: string | null
}

export function getRegisteredAuthData($: IGlobalVariable): AuthData {
  const authData = $.auth?.data as AuthData

  if (!authData || !authData.folderId || !authData.tenantKey) {
    throw new Error('Invalid auth data; missing tenant or folder!')
  }

  return authData
}

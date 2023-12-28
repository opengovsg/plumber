import type { IJSONObject } from '@plumber/types'

export interface AuthData extends IJSONObject {
  tenantKey: string
  folderId?: string | null
}

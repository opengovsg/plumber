import type { IGlobalVariable } from '@plumber/types'

import z from 'zod'

import { isM365TenantKey } from '@/config/app-env-vars/m365'

const authDataSchema = z.object({
  tenantKey: z.string().refine(isM365TenantKey),
  folderId: z.string().toUpperCase(),
})

export type AuthData = z.infer<typeof authDataSchema>

export function extractAuthDataWithPlumberFolder($: IGlobalVariable): AuthData {
  return authDataSchema.parse($.auth?.data)
}

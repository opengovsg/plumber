import type { IGlobalVariable } from '@plumber/types'
import z from 'zod'

import { isM365TenantKey } from '@/config/app-env-vars/m365'

const authDataSchema = z.object({
  tenantKey: z.string().refine(isM365TenantKey),
  folderId: z.string().toUpperCase(),
})

export type AuthData = z.infer<typeof authDataSchema>

export type AuthDataResult =
  | { status: 'ok'; data: AuthData }
  | { status: 'missing' }
  | { status: 'malformed'; error: z.ZodError }

/**
 * Lets each caller choose its own error, since callers outside a step cannot throw a StepError.
 */
export function parseAuthData($: IGlobalVariable): AuthDataResult {
  const authData = $.auth?.data
  // The user deleted the connection or never set one.
  if (authData == null) {
    return { status: 'missing' }
  }

  const result = authDataSchema.safeParse(authData)
  if (result.success === false) {
    return { status: 'malformed', error: result.error }
  }
  return { status: 'ok', data: result.data }
}

export function extractAuthDataWithPlumberFolder($: IGlobalVariable): AuthData {
  return authDataSchema.parse($.auth?.data)
}

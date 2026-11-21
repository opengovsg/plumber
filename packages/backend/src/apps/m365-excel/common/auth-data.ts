import type { IGlobalVariable } from '@plumber/types'
import z from 'zod'

import { isM365TenantKey } from '@/config/app-env-vars/m365'
import StepError, { GenericSolution } from '@/errors/step'

import { toInternalStepError } from './internal-step-error'

const authDataSchema = z.object({
  tenantKey: z.string().refine(isM365TenantKey),
  folderId: z.string().toUpperCase(),
})

export type AuthData = z.infer<typeof authDataSchema>

export function extractAuthDataWithPlumberFolder($: IGlobalVariable): AuthData {
  const authData = $.auth?.data
  // Config because the user deleted the connection or never set one.
  if (authData == null) {
    throw new StepError({
      name: 'M365 connection is missing',
      solution: GenericSolution.MalformedConnectionData,
      kind: 'config',
    })
  }

  const result = authDataSchema.safeParse(authData)
  if (result.success === false) {
    throw toInternalStepError($, result.error, {
      name: 'M365 connection data is invalid',
      event: 'm365-excel-malformed-auth-data',
    })
  }
  return result.data
}

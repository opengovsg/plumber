import type { IApp } from '@plumber/types'

import globalVariable from '@/helpers/global-variable'
import type Connection from '@/models/connection'
import type Flow from '@/models/flow'
import type User from '@/models/user'

export type ConnectionRegistrationResult =
  | 'unsupported'
  | 'unverified'
  | 'registered'

export async function registerConnectionForFlow({
  user,
  app,
  connection,
  flow,
}: {
  user: User
  app: IApp
  connection: Connection
  flow: Flow
}): Promise<ConnectionRegistrationResult> {
  const auth = app.auth
  if (!auth || !auth.connectionRegistrationType) {
    return 'unsupported'
  }

  // Global registration is not tied to one flow.
  const $ =
    auth.connectionRegistrationType === 'global'
      ? await globalVariable({ connection, app, user })
      : await globalVariable({ connection, app, flow, user })

  const isStillVerified = auth.isStillVerified
  if (!isStillVerified || !(await isStillVerified($))) {
    return 'unverified'
  }

  await auth.registerConnection?.($)
  return 'registered'
}

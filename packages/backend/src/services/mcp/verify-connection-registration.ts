import type { IVerifyConnectionRegistrationOutput } from '@plumber/types'

import apps from '@/apps'
import { FORMSG_WEBHOOK_VERIFICATION_MESSAGE } from '@/apps/formsg/common/webhook-settings'
import globalVariable from '@/helpers/global-variable'
import Flow from '@/models/flow'
import type User from '@/models/user'

export type VerifyRegistrationStatus =
  | 'VERIFIED'
  | 'UNREGISTERED'
  | 'ANOTHER_ENDPOINT'
  | 'ANOTHER_PIPE'

export interface VerifyRegistrationResult {
  status: VerifyRegistrationStatus
  message?: string
}

export async function verifyConnectionRegistrationService(
  user: User,
  stepId: string,
  connectionId: string,
): Promise<VerifyRegistrationResult> {
  const step = await user
    .withAccessibleSteps({ requiredRole: 'editor' })
    .findOne({ 'steps.id': stepId })

  if (!step) {
    throw new Error('Step not found')
  }

  const connection = await user
    .withAccessibleConnections({ requiredRole: 'viewer' })
    .findOne({ 'connections.id': connectionId })

  if (!connection) {
    throw new Error('Connection not found')
  }

  if (connection.userId !== null && connection.userId !== user.id) {
    throw new Error('You cannot use a personal connection that you do not own')
  }

  const app = apps[step.appKey ?? '']
  if (!app?.auth?.verifyConnectionRegistration) {
    throw new Error('App does not support connection registration verification')
  }

  const flow = await Flow.query().findById(step.flowId)
  if (!flow) {
    throw new Error('Flow not found')
  }

  const $ = await globalVariable({ connection, app, flow, user })
  const output: IVerifyConnectionRegistrationOutput =
    await app.auth.verifyConnectionRegistration($)

  if (output.registrationVerified) {
    return { status: 'VERIFIED', message: output.message }
  }

  if (!output.message) {
    return { status: 'UNREGISTERED' }
  }

  if (output.message === FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ANOTHER_ENDPOINT) {
    return { status: 'ANOTHER_ENDPOINT', message: output.message }
  }

  if (output.message === FORMSG_WEBHOOK_VERIFICATION_MESSAGE.ANOTHER_PIPE) {
    return { status: 'ANOTHER_PIPE', message: output.message }
  }

  // UNAUTHORIZED, USER_NOT_FOUND, ERROR — auth/network errors; caller must surface these
  throw new Error(output.message)
}

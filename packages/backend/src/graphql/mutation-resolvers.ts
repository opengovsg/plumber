import type { MutationResolvers } from './__generated__/types.generated'
import createConnection from './mutations/create-connection'
import createFlow from './mutations/create-flow'
import createFlowTransfer from './mutations/create-flow-transfer'
import createStep from './mutations/create-step'
import deleteConnection from './mutations/delete-connection'
import deleteFlow from './mutations/delete-flow'
import deleteStep from './mutations/delete-step'
import executeFlow from './mutations/execute-flow'
import generateAuthUrl from './mutations/generate-auth-url'
import loginWithSelectedSgid from './mutations/login-with-selected-sgid'
import loginWithSgid from './mutations/login-with-sgid'
import logout from './mutations/logout'
import registerConnection from './mutations/register-connection'
import requestOtp from './mutations/request-otp'
import resetConnection from './mutations/reset-connection'
import retryExecutionStep from './mutations/retry-execution-step'
import tilesMutationResolvers from './mutations/tiles'
import updateConnection from './mutations/update-connection'
import updateFlow from './mutations/update-flow'
import updateFlowConfig from './mutations/update-flow-config'
import updateFlowStatus from './mutations/update-flow-status'
import updateFlowTransferStatus from './mutations/update-flow-transfer-status'
import updateStep from './mutations/update-step'
import verifyConnection from './mutations/verify-connection'
import verifyOtp from './mutations/verify-otp'

/**
 * Important:
 * When adding NEW mutations that involve sensitive data like api keys and private keys,
 * be sure to redact it in the morgan middleware. See /backend/src/helpers/morgan.ts.
 */

export default {
  createConnection,
  generateAuthUrl,
  updateConnection,
  resetConnection,
  verifyConnection,
  deleteConnection,
  registerConnection,
  createFlow,
  updateFlow,
  updateFlowStatus,
  updateFlowConfig,
  executeFlow,
  deleteFlow,
  createStep,
  updateStep,
  deleteStep,
  requestOtp,
  verifyOtp,
  retryExecutionStep,
  logout,
  loginWithSgid,
  loginWithSelectedSgid,
  createFlowTransfer,
  updateFlowTransferStatus,
  ...tilesMutationResolvers,
} satisfies MutationResolvers

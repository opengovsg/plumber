import type { MutationResolvers } from './__generated__/types.generated'
import bulkRetryExecutions from './mutations/bulk-retry-executions'
import createConnection from './mutations/create-connection'
import createFlow from './mutations/create-flow'
import createFlowTransfer from './mutations/create-flow-transfer'
import createStep from './mutations/create-step'
import deleteConnection from './mutations/delete-connection'
import deleteFlow from './mutations/delete-flow'
import deleteStep from './mutations/delete-step'
import duplicateFlow from './mutations/duplicate-flow'
import executeFlow from './mutations/execute-flow'
import generateAuthUrl from './mutations/generate-auth-url'
import loginWithSelectedSgid from './mutations/login-with-selected-sgid'
import loginWithSgid from './mutations/login-with-sgid'
import logout from './mutations/logout'
import registerConnection from './mutations/register-connection'
import requestOtp from './mutations/request-otp'
import resetConnection from './mutations/reset-connection'
import retryExecutionStep from './mutations/retry-execution-step'
import retryPartialStep from './mutations/retry-partial-step'
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
 * Want to create a new mutation or modify an existing mutation?
 * 1. Add/Change your mutation in graphql.schema.
 * 2. Run `npm run gqlc` to trigger codegen.
 * 3. Start implementing! You can reference the other mutation implementations
 *    to see how to type your mutation function.
 *
 * If your mutation returns a new model, you'll also need to update
 * schema.gql-to-typescript.ts.
 */

/**
 * == ** IMPORTANT ** ==
 * When adding NEW mutations that involve sensitive data like api keys and private keys,
 * be sure to redact it in the morgan middleware. See /backend/src/helpers/morgan.ts.
 */

export default {
  bulkRetryExecutions,
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
  retryPartialStep,
  logout,
  loginWithSgid,
  loginWithSelectedSgid,
  createFlowTransfer,
  updateFlowTransferStatus,
  duplicateFlow,
  ...tilesMutationResolvers,
} satisfies MutationResolvers

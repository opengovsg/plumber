import createConnection from './mutations/create-connection'
import createFlow from './mutations/create-flow'
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
import updateConnection from './mutations/update-connection'
import updateFlow from './mutations/update-flow'
import updateFlowStatus from './mutations/update-flow-status'
import updateStep from './mutations/update-step'
import verifyConnection from './mutations/verify-connection'
import verifyOtp from './mutations/verify-otp'

const mutationResolvers = {
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
}

export default mutationResolvers

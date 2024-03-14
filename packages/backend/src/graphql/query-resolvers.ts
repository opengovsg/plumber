import getApp from './queries/get-app'
import getApps from './queries/get-apps'
import getConnectedApps from './queries/get-connected-apps'
import getCurrentUser from './queries/get-current-user'
import getDynamicData from './queries/get-dynamic-data'
import getExecution from './queries/get-execution'
import getExecutionSteps from './queries/get-execution-steps'
import getExecutions from './queries/get-executions'
import getFlow from './queries/get-flow'
import getFlows from './queries/get-flows'
import getPendingFlowTransfer from './queries/get-pending-flow-transfer'
import getPlumberStats from './queries/get-plumber-stats'
import getStepWithTestExecutions from './queries/get-step-with-test-executions'
import healthcheck from './queries/healthcheck'
import testConnection from './queries/test-connection'
import tilesQueryResolvers from './queries/tiles'

const queryResolvers = {
  getApps,
  getApp,
  getConnectedApps,
  testConnection,
  getFlow,
  getFlows,
  getStepWithTestExecutions,
  getExecution,
  getExecutions,
  getExecutionSteps,
  getDynamicData,
  getCurrentUser,
  healthcheck,
  ...tilesQueryResolvers,
  getPlumberStats,
  getPendingFlowTransfer,
}

export default queryResolvers

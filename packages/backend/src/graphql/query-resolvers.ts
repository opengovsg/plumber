import type { QueryResolvers } from './__generated__/types.generated'
import getApp from './queries/get-app'
import getApps from './queries/get-apps'
import getConnectedApps from './queries/get-connected-apps'
import getCurrentUser from './queries/get-current-user'
import getDynamicData from './queries/get-dynamic-data'
import getExecution from './queries/get-execution'
import getExecutionSteps from './queries/get-execution-steps'
import getExecutions from './queries/get-executions'
import getFlow from './queries/get-flow'
import getFlowTransferDetails from './queries/get-flow-transfer-details'
import getFlows from './queries/get-flows'
import getPendingFlowTransfers from './queries/get-pending-flow-transfers'
import getPlumberStats from './queries/get-plumber-stats'
import getStepWithTestExecutions from './queries/get-step-with-test-executions'
import healthcheck from './queries/healthcheck'
import testConnection from './queries/test-connection'
import tilesQueryResolvers from './queries/tiles'

/**
 * Want to create a new query or modify an existing query?
 * 1. Add/Change your query in graphql.schema
 * 2. Run `npm run gqlc` to trigger codegen
 * 3. Start implementing! You can reference the other query implementations to
 *    see how to type your query function.
 *
 * If your query returns a new model, you'll also need also update
 * schema.gql-to-typescript.ts.
 */

export default {
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
  getPlumberStats,
  getPendingFlowTransfers,
  getFlowTransferDetails,
  ...tilesQueryResolvers,

  // This is a special stub that enables us to group all our admin-related
  // queries into a special AdminQuery object; each "query" is handled by field
  // resolvers defined in @/graphql/admin/queries.
  admin: () => ({}),
} satisfies QueryResolvers

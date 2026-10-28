import type { ITemplate } from '@plumber/types'

import paginate from '@/helpers/pagination'
import App from '@/models/app'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import FlowTransfer from '@/models/flow-transfers'
import TableMetadata from '@/models/table-metadata'

export type AppGraphQLType = App
export type ExecutionStepGraphQLType = ExecutionStep
export type FlowCollaboratorGraphQLType = FlowCollaborator
export type TableMetadataGraphQLType = TableMetadata
export type FlowTransferGraphQLType = FlowTransfer
// isBuiltIn comes from the Template field resolver.
export type TemplateGraphQLType = ITemplate

// TODO: check if there is a better way to express connections
export type ExecutionStepConnectionGraphQLType = ReturnType<
  typeof paginate<ExecutionStep>
>
export type ExecutionConnectionGraphQLType = ReturnType<
  typeof paginate<Execution>
>
export type FlowConnectionGraphQLType = ReturnType<typeof paginate<Flow>>

// This is a special stub that enables us to group all our admin-related
// queries into a special AdminQuery object. See @/graphql/query-resolvers for
// more context.
export type AdminQueryGraphQLType = Record<string, never>

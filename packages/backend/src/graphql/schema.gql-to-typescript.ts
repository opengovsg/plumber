import paginate from '@/helpers/pagination'
import App from '@/models/app'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import TableMetadata from '@/models/table-metadata'

export type AppGraphQLType = App
export type ExecutionStepGraphQLType = ExecutionStep
export type TableMetadataGraphQLType = TableMetadata

// TODO: check if there is a better way to express connections
export type ExecutionStepConnectionGraphQLType = ReturnType<
  typeof paginate<ExecutionStep>
>
export type ExecutionConnectionGraphQLType = ReturnType<
  typeof paginate<Execution>
>
export type FlowConnectionGraphQLType = ReturnType<typeof paginate<Flow>>

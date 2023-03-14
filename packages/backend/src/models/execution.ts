import type { QueryContext } from 'objection'

import Telemetry from '../helpers/telemetry'

import Base from './base'
import ExecutionStep from './execution-step'
import Flow from './flow'

class Execution extends Base {
  id!: string
  flowId!: string
  testRun: boolean
  internalId: string
  executionSteps: ExecutionStep[]

  static tableName = 'executions'

  static jsonSchema = {
    type: 'object',

    properties: {
      id: { type: 'string', format: 'uuid' },
      flowId: { type: 'string', format: 'uuid' },
      testRun: { type: 'boolean', default: false },
      internalId: { type: 'string' },
    },
  }

  static relationMappings = () => ({
    flow: {
      relation: Base.BelongsToOneRelation,
      modelClass: Flow,
      join: {
        from: 'executions.flow_id',
        to: 'flows.id',
      },
    },
    executionSteps: {
      relation: Base.HasManyRelation,
      modelClass: ExecutionStep,
      join: {
        from: 'executions.id',
        to: 'execution_steps.execution_id',
      },
    },
  })

  async $afterInsert(queryContext: QueryContext) {
    await super.$afterInsert(queryContext)
    Telemetry.executionCreated(this)
  }
}

export default Execution

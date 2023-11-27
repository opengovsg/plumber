import type { IJSONObject } from '@plumber/types'

import Base from './base'
import ExecutionStep from './execution-step'
import Flow from './flow'

type ExecutionStatus = 'success' | 'failure' | null
class Execution extends Base {
  id!: string
  flowId!: string
  testRun: boolean
  internalId: string
  executionSteps: ExecutionStep[]
  status: ExecutionStatus
  appData: IJSONObject

  static tableName = 'executions'

  static jsonSchema = {
    type: 'object',

    properties: {
      id: { type: 'string', format: 'uuid' },
      flowId: { type: 'string', format: 'uuid' },
      testRun: { type: 'boolean', default: false },
      internalId: { type: 'string' },
      appData: { type: ['object', 'null'] },
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

  static async setStatus(executionId: string, status: ExecutionStatus) {
    return Execution.query().findById(executionId).patch({ status })
  }
}

export default Execution

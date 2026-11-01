import Base from '../base'
import ExecutionStep from '../execution-step'
import Flow from '../flow'
import BaseExecution, { type ExecutionStatus } from './base'

class Execution extends BaseExecution {
  flow!: Flow
  executionSteps!: ExecutionStep[]

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

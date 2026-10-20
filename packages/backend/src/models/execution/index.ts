import Base from '../base'
import ExecutionStep from '../execution-step'
import Flow from '../flow'
import BaseExecution from './base'

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

  /**
   * Returns the ended execution, or undefined if it had already ended.
   *
   * IMPORTANT: only a pending execution changes, so each end is counted once.
   */
  static async setStatus(
    executionId: string,
    status: 'success' | 'failure',
  ): Promise<Pick<Execution, 'id' | 'testRun'> | undefined> {
    const [execution] = await Execution.query()
      .patch({ status })
      .where('id', executionId)
      .whereNull('status')
      .returning(['id', 'test_run'])
    return execution
  }
}

export default Execution

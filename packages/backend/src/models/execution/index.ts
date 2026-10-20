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
   * Returns the execution only when this call changes it from pending, so the SLI counts each end once.
   *
   * IMPORTANT: one execution can reach here more than once (e.g. parallel for-each iterations).
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

    // A for-each retry can succeed after another iteration failed the execution, and users must see that success.
    if (!execution && status === 'success') {
      await Execution.query()
        .patch({ status })
        .where('id', executionId)
        .where('status', 'failure')
    }
    return execution
  }
}

export default Execution

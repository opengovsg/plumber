import Base from './base'
import ExecutionStep from './execution-step'
import Flow from './flow'

type ExecutionStatus = 'success' | 'failure' | null
class Execution extends Base {
  id!: string
  flowId!: string
  testRun: boolean
  internalId: string
  flow: Flow
  executionSteps: ExecutionStep[]
  status: ExecutionStatus

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

  /**
   * Returns the ended execution, or undefined if it had already ended.
   *
   * IMPORTANT: only a change from pending returns the execution, so each end is counted once.
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

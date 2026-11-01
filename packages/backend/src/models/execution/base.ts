import Base from '../base'

export type ExecutionStatus = 'success' | 'failure' | null

// IMPORTANT: Holds columns only. The reconciler reads through it without loading the app registry.
class BaseExecution extends Base {
  id!: string
  flowId!: string
  testRun!: boolean
  internalId?: string | null
  status!: ExecutionStatus

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
}

export default BaseExecution

import { IJSONObject, TDataOutMetadata } from '@plumber/types'

import App from './app'
import Base from './base'
import Execution from './execution'
import Step from './step'

class ExecutionStep extends Base {
  id!: string
  executionId!: string
  stepId!: string
  dataIn!: IJSONObject
  dataOut!: IJSONObject
  errorDetails: IJSONObject
  status: 'success' | 'failure'
  appKey: string
  jobId: string
  step: Step

  // A virtual property similar to formattedData on the Connection model.
  // We can't use vanilla virtual attributes here due to a need to interop
  // between frontend, backend, and IGlobalVariable.
  dataOutMetadata?: TDataOutMetadata

  static tableName = 'execution_steps'

  static jsonSchema = {
    type: 'object',

    properties: {
      id: { type: 'string', format: 'uuid' },
      executionId: { type: 'string', format: 'uuid' },
      stepId: { type: 'string' },
      dataIn: { type: ['object', 'null'] },
      dataOut: { type: ['object', 'null'] },
      dataOutMetadata: { type: 'object' },
      status: { type: 'string', enum: ['success', 'failure'] },
      errorDetails: { type: ['object', 'null'] },
      appKey: { type: ['string', 'null'] },
      jobId: { type: ['string', 'null'] },
    },
  }

  static relationMappings = () => ({
    execution: {
      relation: Base.BelongsToOneRelation,
      modelClass: Execution,
      join: {
        from: 'execution_steps.execution_id',
        to: 'executions.id',
      },
    },
    step: {
      relation: Base.BelongsToOneRelation,
      modelClass: Step,
      join: {
        from: 'execution_steps.step_id',
        to: 'steps.id',
      },
    },
  })

  get isFailed() {
    return this.status === 'failure'
  }

  async populateDataOutMetadata(): Promise<void> {
    const { appKey, key: stepKey } = await this.$relatedQuery('step')
    if (!appKey || !stepKey) {
      return
    }
    const app = await App.findOneByKey(appKey)
    this.dataOutMetadata = await app.getDataOutMetadata?.(stepKey, this)
  }

  async $afterFind(): Promise<void> {
    await this.populateDataOutMetadata()
  }
}

export default ExecutionStep

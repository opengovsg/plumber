import type { IJSONObject, IStep, IStepConfig } from '@plumber/types'

import Base from '../base'
import BaseFlow from '../flow/base'

// IMPORTANT: Holds columns only. The reconciler reads through it without loading the app registry.
class BaseStep extends Base {
  id!: string
  flowId!: string
  key?: string
  appKey?: string
  type!: IStep['type']
  connectionId?: string | null
  status!: 'incomplete' | 'completed'
  position!: number
  parameters!: IJSONObject
  flow!: BaseFlow
  config!: IStepConfig
  updatedBy?: string
  version!: number

  static tableName = 'steps'

  static jsonSchema = {
    type: 'object',
    required: ['type'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      flowId: { type: 'string', format: 'uuid' },
      key: { type: ['string', 'null'] },
      appKey: { type: ['string', 'null'], minLength: 1, maxLength: 255 },
      type: { type: 'string', enum: ['action', 'trigger'] },
      connectionId: { type: ['string', 'null'], format: 'uuid' },
      status: {
        type: 'string',
        enum: ['incomplete', 'completed'],
        default: 'incomplete',
      },
      position: { type: 'integer' },
      parameters: { type: 'object' },
      version: { type: 'integer', default: 1 },
    },
  }

  static relationMappings = () => ({
    flow: {
      relation: Base.BelongsToOneRelation,
      modelClass: BaseFlow,
      join: {
        from: 'steps.flow_id',
        to: 'flows.id',
      },
    },
  })
}

export default BaseStep

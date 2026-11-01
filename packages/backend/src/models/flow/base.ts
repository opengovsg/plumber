import { IFlowConfig } from '@plumber/types'

import Base from '../base'

// IMPORTANT: Holds columns only. The reconciler reads through it without loading the app registry.
class BaseFlow extends Base {
  id!: string
  name!: string
  userId!: string
  active!: boolean
  publishedAt?: string | null
  remoteWebhookId?: string | null
  testExecutionId?: string | null
  updatedBy?: string

  /**
   * Null means to use default config.
   */
  config!: IFlowConfig | null

  static tableName = 'flows'

  static jsonSchema = {
    type: 'object',
    required: ['name'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', minLength: 1 },
      userId: { type: 'string', format: 'uuid' },
      remoteWebhookId: { type: 'string' },
      active: { type: 'boolean' },
      updatedBy: { type: 'string', format: 'uuid' },

      config: {
        type: 'object',
        properties: {
          maxQps: {
            type: 'integer',
          },
          rejectIfOverMaxQps: {
            type: 'boolean',
          },
          errorConfig: {
            type: 'object',
            properties: {
              notificationFrequency: {
                type: 'string',
              },
              notificationRecipients: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['editor', 'viewer'],
                },
              },
            },
          },
          isForceClogged: {
            type: 'boolean',
          },
        },
      },
    },
  }
}

export default BaseFlow

import type { IJSONObject } from '@plumber/types'

import addFormats from 'ajv-formats'
import {
  AjvValidator,
  type ColumnNameMappers,
  Model,
  snakeCaseMappers,
} from 'objection'

export default class AppMetadata extends Model {
  id!: string
  appKey!: string
  metadataType!: string
  metadata!: IJSONObject

  static tableName = 'app_metadata'
  static idColumn = 'id'

  static useLimitInFirst = true

  static jsonSchema = {
    type: 'object',
    required: ['id', 'appKey', 'metadataType', 'metadata'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      app: { type: 'string' },
      metadataType: { type: 'string' },
      metadata: {
        type: 'object',
      },
    },
  }

  static get columnNameMappers(): ColumnNameMappers {
    return snakeCaseMappers()
  }

  static createValidator() {
    return new AjvValidator({
      onCreateAjv: (ajv) => {
        addFormats.default(ajv)
      },
      options: {
        allErrors: true,
        validateSchema: true,
        ownProperties: true,
      },
    })
  }

  /**
   * NOTE: We're trusting the app to know their metadata type - hence the `as`
   * cast instead of parsing with Zod or similar.
   */
  static async getAppMetadata<T extends IJSONObject>(
    appKey: string,
    metadataType: string,
  ): Promise<T[]> {
    const results = await this.query()
      .where('app_key', appKey)
      .where('metadata_type', metadataType)

    return results.map((result) => result.metadata as T)
  }
}

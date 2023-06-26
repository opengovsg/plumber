import { IJSONObject } from '@plumber/types'

import { AES, enc } from 'crypto-js'
import type { RelationMappings } from 'objection'
import { ModelOptions, QueryContext } from 'objection'

import appConfig from '@/config/app'

import Base from './base'
import Step from './step'
import User from './user'

class Connection extends Base {
  id!: string
  key!: string
  data: string
  formattedData?: IJSONObject
  userId!: string
  verified: boolean
  draft: boolean
  count?: number
  flowCount?: number

  static tableName = 'connections'

  static jsonSchema = {
    type: 'object',
    required: ['key'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      key: { type: 'string', minLength: 1, maxLength: 255 },
      data: { type: 'string' },
      formattedData: { type: 'object' },
      userId: { type: 'string', format: 'uuid' },
      verified: { type: 'boolean', default: false },
      draft: { type: 'boolean' },
    },
  }

  static relationMappings = (): RelationMappings => ({
    user: {
      relation: Base.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'connections.user_id',
        to: 'users.id',
      },
    },
    steps: {
      relation: Base.HasManyRelation,
      modelClass: Step,
      join: {
        from: 'connections.id',
        to: 'steps.connection_id',
      },
    },
  })

  encryptData(): void {
    if (!this.eligibleForEncryption()) {
      return
    }

    this.data = AES.encrypt(
      JSON.stringify(this.formattedData),
      appConfig.encryptionKey,
    ).toString()

    delete this.formattedData
  }

  decryptData(): void {
    if (!this.eligibleForDecryption()) {
      return
    }

    const decrypted = AES.decrypt(this.data, appConfig.encryptionKey).toString(
      enc.Utf8,
    )

    this.formattedData = decrypted ? JSON.parse(decrypted) : {}
  }

  eligibleForEncryption(): boolean {
    return this.formattedData ? true : false
  }

  eligibleForDecryption(): boolean {
    return this.data ? true : false
  }

  // TODO: Make another abstraction like beforeSave instead of using
  // beforeInsert and beforeUpdate separately for the same operation.
  async $beforeInsert(queryContext: QueryContext): Promise<void> {
    await super.$beforeInsert(queryContext)
    this.encryptData()
  }

  async $beforeUpdate(
    opt: ModelOptions,
    queryContext: QueryContext,
  ): Promise<void> {
    await super.$beforeUpdate(opt, queryContext)
    this.encryptData()
  }

  async $afterFind(): Promise<void> {
    this.decryptData()
  }
}

export default Connection

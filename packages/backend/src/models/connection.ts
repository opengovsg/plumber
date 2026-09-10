import { IJSONObject } from '@plumber/types'
import { AES, enc } from 'crypto-js'
import type { RelationMappings, Transaction } from 'objection'
import { ModelOptions, QueryContext } from 'objection'

import appConfig from '@/config/app'

import Base from './base'
import Flow from './flow'
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
  flow?: Flow
  description?: string

  static tableName = 'connections'

  static jsonSchema = {
    type: 'object',
    required: ['key'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      key: { type: 'string', minLength: 1, maxLength: 255 },
      data: { type: 'string' },
      formattedData: { type: 'object' },
      userId: { type: 'string', format: 'uuid', nullable: true },
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

  /**
   * Duplicates a connection and sets the user id to null
   * This is used during pipe transfer to ensure that the connection is still valid and
   * can be used by the new owner even if the old owner is deleted
   */
  static duplicate = async (
    connectionId: string,
    trx?: Transaction,
  ): Promise<Connection> => {
    const connection = await this.query(trx).findOne({ id: connectionId })

    if (!connection) {
      throw new Error('Connection not found')
    }

    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      userId,
      ...rest
    } = connection

    // only need to duplicate if the connection has a user id
    // it could already be null if the pipe has been transferred before
    if (userId) {
      return this.query(trx).insertAndFetch({
        ...rest,
        userId: null,
      })
    }
  }
}

export default Connection

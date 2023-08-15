import crypto from 'crypto'
import { ModelOptions, QueryContext } from 'objection'

import Base from './base'
import Connection from './connection'
import Execution from './execution'
import Flow from './flow'
import Step from './step'
import TableMetadata from './table-metadata'

class User extends Base {
  id!: string
  email!: string
  otpHash?: string
  otpAttempts: number
  otpSentAt?: Date
  connections?: Connection[]
  flows?: Flow[]
  steps?: Step[]
  executions?: Execution[]
  tables?: TableMetadata[]

  static tableName = 'users'

  static jsonSchema = {
    type: 'object',
    required: ['email'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email', minLength: 1, maxLength: 255 },
    },
  }

  static relationMappings = () => ({
    connections: {
      relation: Base.HasManyRelation,
      modelClass: Connection,
      join: {
        from: 'users.id',
        to: 'connections.user_id',
      },
    },
    flows: {
      relation: Base.HasManyRelation,
      modelClass: Flow,
      join: {
        from: 'users.id',
        to: 'flows.user_id',
      },
    },
    steps: {
      relation: Base.ManyToManyRelation,
      modelClass: Step,
      join: {
        from: 'users.id',
        through: {
          from: 'flows.user_id',
          to: 'flows.id',
        },
        to: 'steps.flow_id',
      },
    },
    executions: {
      relation: Base.ManyToManyRelation,
      modelClass: Execution,
      join: {
        from: 'users.id',
        through: {
          from: 'flows.user_id',
          to: 'flows.id',
        },
        to: 'executions.flow_id',
      },
    },
    tables: {
      relation: Base.HasManyRelation,
      modelClass: TableMetadata,
      join: {
        from: `${this.tableName}.id`,
        to: `${TableMetadata.tableName}.user_id`,
      },
    },
  })

  hashOtp(otp: string) {
    return crypto.scryptSync(otp, this.email, 64).toString('base64')
  }

  async $beforeInsert(queryContext: QueryContext) {
    await super.$beforeInsert(queryContext)
  }

  async $beforeUpdate(opt: ModelOptions, queryContext: QueryContext) {
    await super.$beforeUpdate(opt, queryContext)
  }
}

export default User

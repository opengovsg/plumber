import { QueryContext, ModelOptions } from 'objection';
import Base from './base';
import Connection from './connection';
import Flow from './flow';
import Step from './step';
import Execution from './execution';
import crypto from 'crypto';

class User extends Base {
  id!: string;
  email!: string;
  otpHash?: string;
  otpAttempts: number;
  otpSentAt?: Date;
  connections?: Connection[];
  flows?: Flow[];
  steps?: Step[];
  executions?: Execution[];

  static tableName = 'users';

  static jsonSchema = {
    type: 'object',
    required: ['email'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email', minLength: 1, maxLength: 255 }
    }
  };

  static relationMappings = () => ({
    connections: {
      relation: Base.HasManyRelation,
      modelClass: Connection,
      join: {
        from: 'users.id',
        to: 'connections.user_id'
      }
    },
    flows: {
      relation: Base.HasManyRelation,
      modelClass: Flow,
      join: {
        from: 'users.id',
        to: 'flows.user_id'
      }
    },
    steps: {
      relation: Base.ManyToManyRelation,
      modelClass: Step,
      join: {
        from: 'users.id',
        through: {
          from: 'flows.user_id',
          to: 'flows.id'
        },
        to: 'steps.flow_id'
      }
    },
    executions: {
      relation: Base.ManyToManyRelation,
      modelClass: Execution,
      join: {
        from: 'users.id',
        through: {
          from: 'flows.user_id',
          to: 'flows.id'
        },
        to: 'executions.flow_id'
      }
    }
  });

  hashOtp(otp: string) {
    return crypto.scryptSync(otp, this.email, 64).toString('base64');
  }

  async $beforeInsert(queryContext: QueryContext) {
    await super.$beforeInsert(queryContext);
  }

  async $beforeUpdate(opt: ModelOptions, queryContext: QueryContext) {
    await super.$beforeUpdate(opt, queryContext);
  }
}

export default User;

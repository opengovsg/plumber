import Base from '../base'

// IMPORTANT: Holds columns only. The analytics export reads through it without loading the app.
class BaseUser extends Base {
  id!: string
  email!: string
  lastLoginAt?: Date

  static tableName = 'users'

  static jsonSchema = {
    type: 'object',
    required: ['email'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email', minLength: 1, maxLength: 255 },
    },
  }
}

export default BaseUser

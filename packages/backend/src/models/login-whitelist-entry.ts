import addFormats from 'ajv-formats'
import { AjvValidator, Model } from 'objection'

export type LoginWhitelistEntryType =
  | 'email'
  | 'exact_domain'
  | 'domain_and_subdomain'

class LoginWhitelistEntry extends Model {
  value!: string
  type!: LoginWhitelistEntryType

  static tableName = 'login_whitelist'
  static idColumn = 'value'

  static useLimitInFirst = true

  static jsonSchema = {
    type: 'object',
    required: ['value', 'type'],

    properties: {
      type: {
        type: 'string',
        enum: ['email', 'exact_domain', 'domain_and_subdomain'],
      },
    },

    allOf: [
      {
        if: { properties: { type: { const: 'email' } }, required: ['type'] },
        then: { properties: { value: { type: 'string', format: 'email' } } },
      },
      {
        if: {
          properties: { type: { const: 'exact_domain' } },
          required: ['type'],
        },
        then: { properties: { value: { type: 'string', format: 'hostname' } } },
      },
      {
        if: {
          properties: { type: { const: 'domain_and_subdomain' } },
          required: ['type'],
        },
        then: { properties: { value: { type: 'string', format: 'hostname' } } },
      },
    ],
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
}

export default LoginWhitelistEntry

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

  /**
   * Checks if an email address / domain is whitelisted.
   *
   * @param email A *valid* (RFC 5322 compliant) email address.
   * @returns Whether the email address is whitelisted.
   */
  static async isWhitelisted(email: string): Promise<boolean> {
    // Assumes that email is valid, so safe to extract domain by splitting.
    const domain = email.split('@')[1]

    return (
      (await this.query()
        .findOne((builder) =>
          builder
            .where((builder) =>
              builder.where('type', 'email').andWhere('value', email),
            )
            .orWhere((builder) =>
              builder.where('type', 'exact_domain').andWhere('value', domain),
            )
            .orWhere((builder) =>
              builder
                .where('type', 'domain_and_subdomain')
                .andWhere((nested_builder) =>
                  nested_builder
                    // Match exact domain
                    .where('value', domain)
                    // Match subdomains (the dot prevents matching on the
                    // suffix of a different domain)
                    .orWhereRaw('? like concat(\'%.\', "value")', [domain]),
                ),
            ),
        )
        .resultSize()) === 1
    )
  }
}

export default LoginWhitelistEntry

import { describe, expect, it } from 'vitest'

import getConnectionEnvironment from '../../auth/get-connection-environment'

describe('M365 Excel getConnectionEnvironment', () => {
  it('maps the tenant key to its environment', () => {
    expect(getConnectionEnvironment({ tenantKey: 'sg-moe' })).toEqual({
      id: 'sg-moe',
      label: 'SG MOE SharePoint',
    })
  })

  it('returns null for unknown or missing tenant key', () => {
    expect(getConnectionEnvironment()).toBeNull()
    expect(getConnectionEnvironment({})).toBeNull()
    expect(getConnectionEnvironment({ tenantKey: 'not-a-tenant' })).toBeNull()
  })
})

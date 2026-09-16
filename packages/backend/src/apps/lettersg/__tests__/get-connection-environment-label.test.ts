import { describe, expect, it } from 'vitest'

import getConnectionEnvironmentLabel from '../auth/get-connection-environment-label'
import { LetterSgEnvironment } from '../common/api'

describe('LetterSG getConnectionEnvironmentLabel', () => {
  it('maps staging env to Staging', () => {
    expect(
      getConnectionEnvironmentLabel({ env: LetterSgEnvironment.Staging }),
    ).toBe('Staging')
  })

  it('maps production env to Production', () => {
    expect(
      getConnectionEnvironmentLabel({ env: LetterSgEnvironment.Prod }),
    ).toBe('Production')
  })

  it('returns null for unknown or missing env', () => {
    expect(getConnectionEnvironmentLabel()).toBeNull()
    expect(getConnectionEnvironmentLabel({ env: 'prod' })).toBeNull()
  })
})

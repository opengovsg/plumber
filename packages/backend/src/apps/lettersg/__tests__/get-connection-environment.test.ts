import { describe, expect, it } from 'vitest'

import getConnectionEnvironment from '../auth/get-connection-environment'
import { LetterSgEnvironment } from '../common/api'

describe('LetterSG getConnectionEnvironment', () => {
  it('maps staging env to Staging', () => {
    expect(
      getConnectionEnvironment({ env: LetterSgEnvironment.Staging }),
    ).toEqual({ id: LetterSgEnvironment.Staging, label: 'Staging' })
  })

  it('maps production env to Production', () => {
    expect(getConnectionEnvironment({ env: LetterSgEnvironment.Prod })).toEqual(
      { id: LetterSgEnvironment.Prod, label: 'Production' },
    )
  })

  it('returns null for unknown or missing env', () => {
    expect(getConnectionEnvironment()).toBeNull()
    expect(getConnectionEnvironment({ env: 'prod' })).toBeNull()
  })
})

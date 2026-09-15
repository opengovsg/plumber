import { describe, expect, it } from 'vitest'

import { getConnectionEnvLabel } from '../connection-label'

describe('getConnectionEnvLabel', () => {
  it('maps LetterSG stored env values', () => {
    expect(getConnectionEnvLabel('test')).toBe('Staging')
    expect(getConnectionEnvLabel('live')).toBe('Production')
    expect(getConnectionEnvLabel('prod')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'

import { screenNameSchema } from '../app-auth-schema'

describe('app-auth-schema', () => {
  it('should validate the screen name', () => {
    const result = screenNameSchema.safeParse('test')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('test')
    }
  })

  it('should allow exactly 128 characters', () => {
    const result = screenNameSchema.safeParse('a'.repeat(128))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('a'.repeat(128))
    }
  })

  it('should fail if the screen name is too long', () => {
    const result = screenNameSchema.safeParse('a'.repeat(129))
    expect(result.success).toBe(false)
    if (result.success === false) {
      expect(result.error.issues[0].message).toBe(
        'Connection label is too long',
      )
    }
  })

  it('should fail if the screen name is empty', () => {
    const result = screenNameSchema.safeParse('')
    expect(result.success).toBe(false)
    if (result.success === false) {
      expect(result.error.issues[0].message).toBe('Empty connection label')
    }
  })
})

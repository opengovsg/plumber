import { randomUUID } from 'crypto'

import { describe, expect, it } from 'vitest'

import {
  MAX_STEP_NAME_LENGTH,
  renameStepSchema,
} from '@/graphql/mutations/rename-step'

const validInput = (stepName: string) => ({
  id: randomUUID(),
  flow: { id: randomUUID(), updatedAt: '1795507692339' },
  stepName,
})

describe('renameStepSchema', () => {
  it('accepts a name at the length limit', () => {
    const name = 'a'.repeat(MAX_STEP_NAME_LENGTH)
    expect(renameStepSchema.parse(validInput(name)).stepName).toBe(name)
  })

  it('rejects a name over the length limit', () => {
    const name = 'a'.repeat(MAX_STEP_NAME_LENGTH + 1)
    const result = renameStepSchema.safeParse(validInput(name))
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe(
      'Step names can be up to 64 characters.',
    )
  })

  it('trims the name before checking its length', () => {
    const name = ` ${'a'.repeat(MAX_STEP_NAME_LENGTH)} `
    expect(renameStepSchema.parse(validInput(name)).stepName).toBe(
      'a'.repeat(MAX_STEP_NAME_LENGTH),
    )
  })

  it('accepts an empty name, which resets to the default name', () => {
    expect(renameStepSchema.parse(validInput('   ')).stepName).toBe('')
  })

  it('rejects a step id that is not a UUID', () => {
    const input = { ...validInput('Name'), id: 'not-a-uuid' }
    expect(renameStepSchema.safeParse(input).success).toBe(false)
  })

  it('rejects a flow timestamp that is not epoch milliseconds', () => {
    const input = validInput('Name')
    input.flow.updatedAt = '2026-11-24T14:00:00Z'
    expect(renameStepSchema.safeParse(input).success).toBe(false)
  })
})

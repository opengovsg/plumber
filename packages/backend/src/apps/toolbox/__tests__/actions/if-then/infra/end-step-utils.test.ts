import { describe, expect, it } from 'vitest'

import { deriveIfThenV1EndStep } from '../../../../actions/if-then/infra/end-step-utils'

type Fixture = {
  id: string
  appKey?: string
  key?: string
  parameters?: Record<string, any>
  position: number
}

const trigger = (position: number): Fixture => ({
  id: `trigger${position}`,
  appKey: 'formsg',
  key: 'newSubmission',
  position,
})

const plain = (id: string, position: number): Fixture => ({
  id,
  appKey: 'postman',
  key: 'sendTransactionalEmail',
  position,
})

const ifThen = (
  id: string,
  position: number,
  extra: Partial<Fixture> = {},
): Fixture => ({
  id,
  appKey: 'toolbox',
  key: 'ifThen',
  parameters: { depth: '0' },
  position,
  ...extra,
})

const mrfSubmission = (id: string, position: number): Fixture => ({
  id,
  appKey: 'formsg',
  key: 'mrfSubmission',
  position,
})

describe('deriveIfThenV1EndStep', () => {
  it('derives the extent of a 2-branch block up to the step before the next if-then', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const stepA = plain('stepA', 3)
    const ifThenB = ifThen('ifThenB', 4)
    const stepB = plain('stepB', 5)
    const steps = [trigger(1), ifThenA, stepA, ifThenB, stepB]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('stepA')
    expect(deriveIfThenV1EndStep(steps, ifThenB).id).toBe('stepB')
  })

  it('derives extents for each branch of a 3-branch block', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const ifThenB = ifThen('ifThenB', 4)
    const ifThenC = ifThen('ifThenC', 6)
    const steps = [
      trigger(1),
      ifThenA,
      plain('stepA', 3),
      ifThenB,
      plain('stepB', 5),
      ifThenC,
      plain('stepC', 7),
    ]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('stepA')
    expect(deriveIfThenV1EndStep(steps, ifThenB).id).toBe('stepB')
    expect(deriveIfThenV1EndStep(steps, ifThenC).id).toBe('stepC')
  })

  it('extends to the end of the flow when there is no following if-then', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const steps = [
      trigger(1),
      ifThenA,
      plain('stepA', 3),
      plain('stepB', 4),
      plain('stepC', 5),
    ]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('stepC')
  })

  it('returns the if-then itself (self-ref) for an empty block abutting the next if-then', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const ifThenB = ifThen('ifThenB', 3)
    const steps = [trigger(1), ifThenA, ifThenB, plain('stepB', 4)]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('ifThenA')
  })

  it('treats a following (reject-branch) if-then as an MRF boundary', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const rejectIfThen = ifThen('rejectIfThen', 5, {
      parameters: { depth: '0' },
    })
    const steps = [
      trigger(1),
      ifThenA,
      plain('stepA', 3),
      mrfSubmission('mrf', 4),
      rejectIfThen,
      plain('stepAfter', 6),
    ]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('mrf')
  })

  it('does not treat a deeper (nested) if-then as a boundary (mirrors V1 depth scan)', () => {
    const ifThenA = ifThen('ifThenA', 2)
    const nested = ifThen('nested', 4, { parameters: { depth: '1' } })
    const ifThenB = ifThen('ifThenB', 6)
    const steps = [
      trigger(1),
      ifThenA,
      plain('stepA', 3),
      nested,
      plain('stepB', 5),
      ifThenB,
      plain('stepC', 7),
    ]

    expect(deriveIfThenV1EndStep(steps, ifThenA).id).toBe('stepB')
  })
})

import type { IStep } from '@plumber/types'
import { describe, expect, it } from 'vitest'

import { shouldCreateEmptyStep } from '../utils'

const plain = (id: string): IStep =>
  ({ id, appKey: 'postman', key: 'sendTransactionalEmail' }) as IStep

// A marker-less if-then (if-then V1) as the editor actually receives one: a
// GraphQL response carries every field the query selected, so the marker is
// present and null rather than absent. IStepConfig describes the backend's own
// DB shape, where the key really is missing, hence the cast.
const ifThenV1 = (id: string): IStep =>
  ({
    id,
    appKey: 'toolbox',
    key: 'ifThen',
    config: { endStepId: null },
  }) as unknown as IStep

// The same step with the key genuinely absent — what a locally built step looks
// like before any round trip.
const ifThenV1NoConfig = (id: string): IStep =>
  ({ id, appKey: 'toolbox', key: 'ifThen' }) as IStep

const ifThenV2 = (id: string): IStep =>
  ({ id, appKey: 'toolbox', key: 'ifThen', config: { endStepId: id } }) as IStep

describe('shouldCreateEmptyStep', () => {
  it('is true when deleting the last step of an if-then V1 branch abutting the next branch', () => {
    expect(shouldCreateEmptyStep(ifThenV1('a'), ifThenV1('b'))).toBe(true)
  })

  it('is true when deleting the last step of the last if-then V1 branch', () => {
    expect(shouldCreateEmptyStep(ifThenV1('a'), undefined)).toBe(true)
  })

  it('is true for an if-then V1 whose config carries no marker key at all', () => {
    expect(shouldCreateEmptyStep(ifThenV1NoConfig('a'), undefined)).toBe(true)
  })

  it('is false when a non-if-then step follows (not the last step in the branch)', () => {
    expect(shouldCreateEmptyStep(ifThenV1('a'), plain('b'))).toBe(false)
  })

  it('is false when the previous step is not an if-then', () => {
    expect(shouldCreateEmptyStep(plain('a'), ifThenV1('b'))).toBe(false)
  })

  it('is false when there is no previous step', () => {
    expect(shouldCreateEmptyStep(undefined, ifThenV1('b'))).toBe(false)
  })

  it('is false when the previous step is an explicit if-then V2 block (its marker is repaired server-side)', () => {
    expect(shouldCreateEmptyStep(ifThenV2('a'), ifThenV2('b'))).toBe(false)
    expect(shouldCreateEmptyStep(ifThenV2('a'), undefined)).toBe(false)
  })
})

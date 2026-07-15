import { IStep } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  dismissMrfApprovalHint,
  hasSeenMrfApprovalHint,
  MRF_APPROVAL_HINT_STORAGE_KEY,
  shouldWarnMrfOnlyContinueIf,
} from '@/helpers/formsg'
import * as storage from '@/helpers/storage'

describe('MRF approval hint dismissal', () => {
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    vi.spyOn(storage, 'getItem').mockImplementation((key) => store[key] ?? null)
    vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
      store[key] = value
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports the hint as unseen when nothing is stored', () => {
    expect(hasSeenMrfApprovalHint()).toBe(false)
  })

  it('reports the hint as seen once it has been dismissed', () => {
    dismissMrfApprovalHint()
    expect(hasSeenMrfApprovalHint()).toBe(true)
  })

  it('persists dismissal under the namespaced storage key', () => {
    dismissMrfApprovalHint()
    expect(store[MRF_APPROVAL_HINT_STORAGE_KEY]).toBeDefined()
  })
})

describe('shouldWarnMrfOnlyContinueIf', () => {
  const onlyContinueIfStep = {
    id: 'oci',
    appKey: 'toolbox',
    key: 'onlyContinueIf',
    position: 3,
  } as IStep

  const subtriggerAt = (position: number) =>
    ({
      id: `mrf-${position}`,
      appKey: 'formsg',
      key: 'mrfSubmission',
      position,
    } as IStep)

  it('is false when the step is not "Only continue if"', () => {
    const step = { ...onlyContinueIfStep, key: 'ifThen' } as IStep
    expect(
      shouldWarnMrfOnlyContinueIf({ step, mrfSteps: [subtriggerAt(5)] }),
    ).toBe(false)
  })

  it('is false when there are no MRF subtrigger steps', () => {
    expect(
      shouldWarnMrfOnlyContinueIf({ step: onlyContinueIfStep, mrfSteps: [] }),
    ).toBe(false)
  })

  it('is false when every subtrigger is at or before the step position', () => {
    expect(
      shouldWarnMrfOnlyContinueIf({
        step: onlyContinueIfStep,
        mrfSteps: [subtriggerAt(1), subtriggerAt(3)],
      }),
    ).toBe(false)
  })

  it('is true when a subtrigger comes after the step', () => {
    expect(
      shouldWarnMrfOnlyContinueIf({
        step: onlyContinueIfStep,
        mrfSteps: [subtriggerAt(1), subtriggerAt(5)],
      }),
    ).toBe(true)
  })
})

import { IStep } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  dismissMrfApprovalHint,
  filterStepsByApprovalBranch,
  hasSeenMrfApprovalHint,
  isMrfApprovalStep,
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

describe('isMrfApprovalStep', () => {
  const mrfStep = (parameters: IStep['parameters']) =>
    ({
      id: 'mrf',
      appKey: 'formsg',
      key: 'mrfSubmission',
      parameters,
    } as IStep)

  it('is true for an MRF step with an approval field', () => {
    expect(
      isMrfApprovalStep(mrfStep({ mrf: { approvalField: 'field-1' } })),
    ).toBe(true)
  })

  it('is false for an MRF step without an approval field', () => {
    expect(isMrfApprovalStep(mrfStep({ mrf: { type: 'static' } }))).toBe(false)
  })

  it('is false for a step from another app', () => {
    expect(
      isMrfApprovalStep({
        id: 'x',
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        type: 'action',
        position: 2,
        parameters: { mrf: { approvalField: 'field-1' } },
      } as unknown as IStep),
    ).toBe(false)
  })
})

describe('filterStepsByApprovalBranch', () => {
  const plain = (id: string) => ({ id, config: {} } as IStep)
  const rejectOf = (id: string, stepId: string) =>
    ({ id, config: { approval: { branch: 'reject', stepId } } } as IStep)

  const steps = [
    plain('trigger'),
    plain('approval'),
    plain('approved-email'),
    rejectOf('rejected-email', 'approval'),
  ]
  const ids = (list: IStep[]) => list.map((step) => step.id)

  it('hides the reject path when the approval step is on "approve"', () => {
    expect(
      ids(filterStepsByApprovalBranch(steps, { approval: 'approve' })),
    ).toEqual(['trigger', 'approval', 'approved-email'])
  })

  it('shows only the approval step and its reject path on "reject"', () => {
    expect(
      ids(filterStepsByApprovalBranch(steps, { approval: 'reject' })),
    ).toEqual(['trigger', 'approval', 'rejected-email'])
  })

  it('keeps every step when no approval step is selected', () => {
    expect(
      ids(filterStepsByApprovalBranch([plain('a'), plain('b')], {})),
    ).toEqual(['a', 'b'])
  })
})

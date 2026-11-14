import { describe, expect, it } from 'vitest'

import { FORMSG_APP_KEY } from '@/helpers/formsg'
import { TOOLBOX_APP_KEY } from '@/helpers/toolbox'

import {
  canRetryOnlyThisStep,
  type CanRetryOnlyThisStepParams,
} from '../canRetryOnlyThisStep'

const retriable: CanRetryOnlyThisStepParams = {
  appKey: 'postman',
  stepStatus: 'success',
  executionStatus: 'success',
  isTrigger: false,
  role: 'owner',
}

describe('canRetryOnlyThisStep', () => {
  it('allows a successful action step in a finished execution', () => {
    expect(canRetryOnlyThisStep(retriable)).toBe(true)
  })

  it('allows a step in a failed execution', () => {
    expect(
      canRetryOnlyThisStep({ ...retriable, executionStatus: 'failure' }),
    ).toBe(true)
  })

  it.each([
    { label: 'failed step', change: { stepStatus: 'failure' } },
    { label: 'running execution', change: { executionStatus: null } },
    { label: 'trigger', change: { isTrigger: true } },
    { label: 'viewer', change: { role: 'viewer' } },
    {
      label: 'toolbox step',
      change: { appKey: TOOLBOX_APP_KEY },
    },
    { label: 'delay', change: { appKey: 'delay' } },
    { label: 'MRF step', change: { appKey: FORMSG_APP_KEY } },
  ])('rejects a $label', ({ change }) => {
    expect(canRetryOnlyThisStep({ ...retriable, ...change })).toBe(false)
  })
})

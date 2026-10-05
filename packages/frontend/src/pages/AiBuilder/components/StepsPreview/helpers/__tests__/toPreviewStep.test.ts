import { describe, expect, it } from 'vitest'

import type { PipeStateStep } from '@/hooks/useChatStream'

import { toPreviewStep } from '../toPreviewStep'

const baseStep: PipeStateStep = {
  id: 'step-1',
  appKey: 'formsg',
  key: 'mrfSubmission',
  type: 'action',
  position: 2,
  status: 'incomplete',
  parameters: {},
  connectionId: null,
}

describe('toPreviewStep', () => {
  it('exposes the stage name as config.stepName', () => {
    const step = toPreviewStep({ ...baseStep, stepName: 'Approval' })

    expect(step.config?.stepName).toBe('Approval')
  })

  it('leaves config unset when the step has no custom name', () => {
    expect(
      toPreviewStep({ ...baseStep, stepName: null }).config,
    ).toBeUndefined()
    expect(toPreviewStep(baseStep).config).toBeUndefined()
  })

  it('keeps the other fields the preview reads', () => {
    const step = toPreviewStep({
      ...baseStep,
      endStepId: 'end-step',
      connectionLabel: 'My form',
    })

    expect(step).toMatchObject({
      id: 'step-1',
      position: 2,
      endStepId: 'end-step',
      connectionLabel: 'My form',
    })
  })
})

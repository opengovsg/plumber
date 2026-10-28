// Business rule: preserve the topology for toolbox logic.
import { describe, expect, it } from 'vitest'

import { remapTemplateStepConfig } from '../template-step-config'

const oldToPlaceholder = {
  block: '<<step_id_2>>',
  end: '<<step_id_5>>',
  mrf: '<<step_id_1>>',
}

const placeholderToNew = {
  '<<step_id_1>>': 'new-mrf',
  '<<step_id_2>>': 'new-block',
  '<<step_id_5>>': 'new-end',
}

describe('template step topology', () => {
  it('round-trips forward block boundaries and rejection branch ownership', () => {
    const config = {
      stepName: 'Conditional branch',
      endStepId: 'end',
      approval: { branch: 'reject' as const, stepId: 'mrf' },
      adminOverride: { tileScanLimit: 100 },
    }
    const exported = remapTemplateStepConfig(config, oldToPlaceholder)
    expect(exported).toEqual({
      ...config,
      endStepId: '<<step_id_5>>',
      approval: { branch: 'reject', stepId: '<<step_id_1>>' },
    })
    expect(remapTemplateStepConfig(exported, placeholderToNew)).toEqual({
      ...config,
      endStepId: 'new-end',
      approval: { branch: 'reject', stepId: 'new-mrf' },
    })
    expect(config.endStepId).toBe('end')
    expect(config.approval.stepId).toBe('mrf')
  })

  it('preserves self-referencing empty blocks', () => {
    const exported = remapTemplateStepConfig(
      { endStepId: 'block' },
      oldToPlaceholder,
    )
    expect(remapTemplateStepConfig(exported, placeholderToNew)).toEqual({
      endStepId: 'new-block',
    })
  })

  it('does not add a block marker to legacy config', () => {
    expect(remapTemplateStepConfig({ stepName: 'Legacy' }, {})).toEqual({
      stepName: 'Legacy',
    })
  })

  it.each([
    { endStepId: 'missing' },
    { approval: { branch: 'reject' as const, stepId: 'missing' } },
  ])('rejects a reference outside the mapped flow: %j', (config) => {
    expect(() => remapTemplateStepConfig(config, oldToPlaceholder)).toThrow(
      'Template config references an unknown step: missing',
    )
  })
})

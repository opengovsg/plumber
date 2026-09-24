import { describe, expect, it } from 'vitest'

import { createStepAiBuilderConfig } from '../step-ai-builder-config'

describe('step AI builder config', () => {
  it('stamps create_pipe origin', () => {
    expect(createStepAiBuilderConfig('trace-1', 'create_pipe')).toEqual({
      aiBuilderConfig: {
        traceId: 'trace-1',
        tool: 'create_pipe',
      },
    })
  })

  it('stamps create_step origin', () => {
    expect(createStepAiBuilderConfig('trace-2', 'create_step')).toEqual({
      aiBuilderConfig: {
        traceId: 'trace-2',
        tool: 'create_step',
      },
    })
  })
})

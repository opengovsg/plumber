import { describe, expect, it, vi } from 'vitest'

import { promptTelemetryMetadata } from '../prompt-telemetry'

describe('promptTelemetryMetadata', () => {
  it('links Langfuse prompts to their version', () => {
    const prompt = { isFallback: false, toJSON: () => '{"version":211}' }

    expect(promptTelemetryMetadata(prompt)).toEqual({
      promptSource: 'langfuse',
      langfusePrompt: '{"version":211}',
    })
  })

  it('never sends a local prompt for Langfuse to link', () => {
    const toJSON = vi.fn()

    expect(promptTelemetryMetadata({ isFallback: true, toJSON })).toEqual({
      promptSource: 'local',
    })
    expect(toJSON).not.toHaveBeenCalled()
  })
})

import type { ITemplate } from '@plumber/types'

import { describe, expect, it, vi } from 'vitest'

import { searchTemplates } from '../template-search'

const templates: ITemplate[] = [
  { id: 'slack', name: 'Slack', description: 'Post to Slack', steps: [] },
  { id: 'email', name: 'Email', description: 'Send emails', steps: [] },
  { id: 'tiles', name: 'Tiles', description: 'Track in Tiles', steps: [] },
]

describe('searchTemplates', () => {
  it('orders matches by probability and drops those below the floor', async () => {
    const evaluateTemplates = vi.fn().mockResolvedValue({
      slack: 0.4,
      email: 0.9,
      tiles: 0.29,
    })

    const ids = await searchTemplates({
      query: '  notify people  ',
      templates,
      evaluateTemplates,
    })

    expect(ids).toEqual(['email', 'slack'])
    expect(evaluateTemplates).toHaveBeenCalledWith({
      query: 'notify people',
      templates,
    })
  })

  it('drops IDs that are not in the template list', async () => {
    const evaluateTemplates = vi.fn().mockResolvedValue({ unknown: 0.99 })

    const ids = await searchTemplates({
      query: 'anything',
      templates,
      evaluateTemplates,
    })

    expect(ids).toEqual([])
  })

  it('skips the model call for a blank query', async () => {
    const evaluateTemplates = vi.fn()

    const ids = await searchTemplates({
      query: '   ',
      templates,
      evaluateTemplates,
    })

    expect(ids).toEqual([])
    expect(evaluateTemplates).not.toHaveBeenCalled()
  })
})

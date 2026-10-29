import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadUserState, recordPrompt } from './storage'

const USER_ID = 'user-1'
const NOW = new Date('2026-06-01T00:00:00Z')

beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  })
})

describe('recordPrompt', () => {
  it('starts the global gate by default', () => {
    recordPrompt(USER_ID, { type: 'csat' }, NOW)

    const state = loadUserState(USER_ID, null)
    expect(state.lastPromptAt).toEqual(NOW)
    expect(state.lastCsatAt).toEqual(NOW)
  })

  it('records the pipe SEQ without starting the global gate', () => {
    recordPrompt(USER_ID, { type: 'seq', flow: 'pipe' }, NOW, {
      startsGlobalGate: false,
    })

    const state = loadUserState(USER_ID, null)
    expect(state.lastPromptAt).toBeNull()
    expect(state.lastSeqAt.pipe).toEqual(NOW)
  })

  it('leaves earlier prompt dates alone when the gate is not started', () => {
    const earlier = new Date('2026-05-01T00:00:00Z')
    recordPrompt(USER_ID, { type: 'csat' }, earlier)
    recordPrompt(USER_ID, { type: 'seq', flow: 'pipe' }, NOW, {
      startsGlobalGate: false,
    })

    const state = loadUserState(USER_ID, null)
    expect(state.lastPromptAt).toEqual(earlier)
    expect(state.lastCsatAt).toEqual(earlier)
    expect(state.lastSeqAt.pipe).toEqual(NOW)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearAbandonForRef,
  getPendingAbandon,
  getSession,
  loadUserState,
  markSessionPromptShown,
  queueAbandon,
  recordPrompt,
} from '../storage'

const USER_ID = 'user-1'
const NOW = new Date('2026-06-01T00:00:00Z')
const STATE_KEY = `plumber:survey:v1:${USER_ID}`

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('sessionStorage', memoryStorage())
})

describe('recordPrompt', () => {
  it('starts the global gate by default', () => {
    recordPrompt(USER_ID, { type: 'csat' }, NOW)

    const state = loadUserState(USER_ID, null)
    expect(state.lastPromptAt).toEqual(NOW)
    expect(state.lastCsatAt).toEqual(NOW)
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

describe('recordPrompt with an older date', () => {
  it('keeps the later dates already stored', () => {
    recordPrompt(USER_ID, { type: 'csat' }, NOW)
    recordPrompt(USER_ID, { type: 'csat' }, new Date('2026-05-01T00:00:00Z'))

    const state = loadUserState(USER_ID, null)
    expect(state.lastPromptAt).toEqual(NOW)
    expect(state.lastCsatAt).toEqual(NOW)
  })
})

describe('loadUserState', () => {
  it('reads corrupt fields as never and keeps valid ones', () => {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        lastPromptAt: NOW.toISOString(),
        lastCsatAt: 42,
        lastSeqAt: { pipe: 'garbage' },
      }),
    )

    expect(loadUserState(USER_ID, null)).toEqual({
      signupAt: null,
      lastPromptAt: NOW,
      lastCsatAt: null,
      lastSeqAt: { pipe: null, regular: null, aiBuilder: null },
    })
  })

  it('reads unparsable JSON as an empty state', () => {
    localStorage.setItem(STATE_KEY, '{oops')

    expect(loadUserState(USER_ID, null).lastPromptAt).toBeNull()
  })
})

describe('abandon queue', () => {
  beforeEach(() => {
    queueAbandon(USER_ID, { flow: 'regular', refId: 'pipe-1' }, NOW)
  })

  it('keeps the abandon when the user opens a different pipe', () => {
    clearAbandonForRef(USER_ID, 'pipe-2')

    expect(getPendingAbandon(USER_ID, NOW)).toMatchObject({
      flow: 'regular',
      type: 'abandon',
      pipeId: 'pipe-1',
    })
  })

  it('clears the abandon when the user returns to the same pipe', () => {
    clearAbandonForRef(USER_ID, 'pipe-1')

    expect(getPendingAbandon(USER_ID, NOW)).toBeNull()
  })

  it('drops an expired abandon from storage', () => {
    const afterExpiry = new Date(NOW.getTime() + 49 * 60 * 60 * 1000)

    expect(getPendingAbandon(USER_ID, afterExpiry)).toBeNull()
    expect(JSON.parse(localStorage.getItem(STATE_KEY)!).pendingAbandon).toBe(
      null,
    )
  })

  it('clears the abandon once the user acts on its survey', () => {
    recordPrompt(USER_ID, { type: 'seq', flow: 'regular' }, NOW)

    expect(getPendingAbandon(USER_ID, NOW)).toBeNull()
  })
})

describe('session gate', () => {
  it('does not carry over to the next user in the same tab', () => {
    markSessionPromptShown(USER_ID)

    expect(getSession(USER_ID).promptShown).toBe(true)
    expect(getSession('user-2').promptShown).toBe(false)
  })
})

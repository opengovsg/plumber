import { describe, expect, it } from 'vitest'

import { SURVEY_CONFIG } from './config'
import { evaluate, SurveyTrigger, SurveyUserState } from './engine'

const NOW = new Date('2026-06-01T00:00:00Z')

// The scenarios below pin the gate and cooldown rules, so they run without the
// always-show override.
const GATED_CONFIG = { ...SURVEY_CONFIG, pipeCompletionAlwaysShows: false }

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
}

function makeUser(overrides: Partial<SurveyUserState> = {}): SurveyUserState {
  return {
    userId: 'user-1',
    signupAt: daysAgo(365),
    lastPromptAt: null,
    lastCsatAt: null,
    lastSeqAt: { pipe: null, regular: null },
    ...overrides,
  }
}

const completion: SurveyTrigger = {
  isPausePoint: false,
  seqCandidate: { flow: 'pipe', type: 'completion' },
}
const pause: SurveyTrigger = { isPausePoint: true }

function run(
  trigger: SurveyTrigger,
  user: SurveyUserState,
  sessionPromptShown = false,
  config = GATED_CONFIG,
) {
  return evaluate({ trigger, user, sessionPromptShown, config, now: NOW })
}

describe('evaluate', () => {
  it('1. shows SEQ on pipe completion with no prior prompts', () => {
    expect(run(completion, makeUser())).toEqual({
      type: 'SEQ',
      flow: 'pipe',
      trigger: 'completion',
    })
  })

  it('2. shows nothing within the global gate', () => {
    expect(run(completion, makeUser({ lastPromptAt: daysAgo(5) }))).toEqual({
      type: 'NONE',
      reason: 'global_gate',
    })
  })

  it('3. never shows CSAT in the same session as a prompt', () => {
    expect(run(pause, makeUser(), true)).toEqual({
      type: 'NONE',
      reason: 'session_gate',
    })
  })

  it('4. SEQ wins over CSAT when CSAT is due but not overdue', () => {
    const user = makeUser({ lastCsatAt: daysAgo(35) })
    expect(run({ ...completion, isPausePoint: true }, user)).toEqual({
      type: 'SEQ',
      flow: 'pipe',
      trigger: 'completion',
    })
  })

  it('5. CSAT wins over SEQ once overdue', () => {
    const user = makeUser({ lastCsatAt: daysAgo(50) })
    expect(run({ ...completion, isPausePoint: true }, user)).toEqual({
      type: 'CSAT',
    })
  })

  it('6. shows a queued abandon and drops an expired one', () => {
    const candidate = { flow: 'regular' as const, type: 'abandon' as const }
    expect(
      run(
        {
          isPausePoint: true,
          seqCandidate: { ...candidate, expiresAt: daysAgo(-1) },
        },
        makeUser({ lastCsatAt: daysAgo(1) }),
      ),
    ).toEqual({ type: 'SEQ', flow: 'regular', trigger: 'abandon' })
    expect(
      run(
        {
          isPausePoint: true,
          seqCandidate: { ...candidate, expiresAt: daysAgo(1) },
        },
        makeUser({ lastCsatAt: daysAgo(1) }),
      ),
    ).toEqual({ type: 'NONE', reason: 'expired' })
  })

  it('8. shows CSAT at a pause point when due', () => {
    expect(run(pause, makeUser({ lastCsatAt: daysAgo(31) }))).toEqual({
      type: 'CSAT',
    })
    expect(run(pause, makeUser({ lastCsatAt: daysAgo(10) }))).toEqual({
      type: 'NONE',
      reason: 'csat_cooldown',
    })
  })

  it('9. blocks SEQ within the per-flow cooldown', () => {
    const user = makeUser({
      lastSeqAt: { pipe: daysAgo(10), regular: null },
    })
    expect(run(completion, user)).toEqual({
      type: 'NONE',
      reason: 'flow_cooldown',
    })
  })

  it('10. suppresses CSAT for new users but allows SEQ', () => {
    const user = makeUser({ signupAt: daysAgo(5) })
    expect(run(pause, user)).toEqual({ type: 'NONE', reason: 'new_user' })
    expect(run(completion, user)).toEqual({
      type: 'SEQ',
      flow: 'pipe',
      trigger: 'completion',
    })
  })

  it('12. treats a user with no prior state as never surveyed', () => {
    expect(
      run(
        pause,
        makeUser({ signupAt: null, lastPromptAt: null, lastCsatAt: null }),
      ),
    ).toEqual({ type: 'CSAT' })
  })

  it('returns NONE with no reason for a non-pause trigger without a candidate', () => {
    expect(run({ isPausePoint: false }, makeUser())).toEqual({ type: 'NONE' })
  })

  it('does not condition CSAT on SEQ history', () => {
    const user = makeUser({
      lastSeqAt: { pipe: daysAgo(20), regular: daysAgo(20) },
    })
    expect(run(pause, user)).toEqual({ type: 'CSAT' })
  })
})

describe('evaluate with pipeCompletionAlwaysShows', () => {
  const config = { ...SURVEY_CONFIG, pipeCompletionAlwaysShows: true }
  const expected = { type: 'SEQ', flow: 'pipe', trigger: 'completion' }

  it('shows on every pipe completion despite every gate', () => {
    expect(
      run(
        completion,
        makeUser({
          lastPromptAt: daysAgo(1),
          lastSeqAt: { pipe: daysAgo(1), regular: null },
        }),
        true,
        config,
      ),
    ).toEqual(expected)
  })

  it('still gates the other surveys', () => {
    const user = makeUser({ lastPromptAt: daysAgo(1) })
    expect(run(pause, user, false, config)).toEqual({
      type: 'NONE',
      reason: 'global_gate',
    })
    expect(
      run(
        {
          isPausePoint: false,
          seqCandidate: { flow: 'regular', type: 'abandon' },
        },
        user,
        false,
        config,
      ),
    ).toEqual({ type: 'NONE', reason: 'global_gate' })
  })
})

describe('after a pipe SEQ that did not start the global gate', () => {
  // The pipe SEQ records its own date but leaves lastPromptAt untouched.
  const user = makeUser({ lastSeqAt: { pipe: daysAgo(0), regular: null } })

  it('blocks CSAT for the rest of the session', () => {
    expect(run(pause, user, true)).toEqual({
      type: 'NONE',
      reason: 'session_gate',
    })
  })

  it('lets CSAT show in the next session', () => {
    expect(run(pause, user, false)).toEqual({ type: 'CSAT' })
  })

  it('lets an overdue CSAT show in the next session', () => {
    const overdue = makeUser({
      lastCsatAt: daysAgo(50),
      lastSeqAt: { pipe: daysAgo(0), regular: null },
    })
    expect(run(pause, overdue, false)).toEqual({ type: 'CSAT' })
  })
})

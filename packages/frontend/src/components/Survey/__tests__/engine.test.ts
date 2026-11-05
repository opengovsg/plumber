import { describe, expect, it } from 'vitest'

import { SURVEY_CONFIG } from '../config'
import {
  checkHistory,
  evaluate,
  lastActedAt,
  SurveyTrigger,
  SurveyUserState,
} from '../engine'

// Interval rules live in engine.critical.test.ts. This file covers priority,
// expiry and edge cases.

const NOW = new Date('2026-06-01T00:00:00Z')

// Lets the publish SEQ compete with CSAT instead of always winning.
const GATED_CONFIG = { ...SURVEY_CONFIG, pipeCompletionAlwaysShows: false }

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
}

function makeUser(overrides: Partial<SurveyUserState> = {}): SurveyUserState {
  return {
    signupAt: daysAgo(365),
    lastPromptAt: null,
    lastCsatAt: null,
    lastSeqAt: { pipe: null, regular: null, aiBuilder: null },
    ...overrides,
  }
}

const completion: SurveyTrigger = {
  isPausePoint: false,
  seqCandidate: { flow: 'pipe', type: 'completion' },
}
const pause: SurveyTrigger = { isPausePoint: true }
const pipeSeq = { type: 'SEQ', flow: 'pipe', trigger: 'completion' } as const

function run(
  trigger: SurveyTrigger,
  user: SurveyUserState,
  { sessionPromptShown = false, config = GATED_CONFIG } = {},
) {
  return evaluate({ trigger, user, sessionPromptShown, config, now: NOW })
}

describe('evaluate', () => {
  it('prefers SEQ over a CSAT that is due but not overdue', () => {
    const user = makeUser({ lastCsatAt: daysAgo(35) })
    expect(run({ ...completion, isPausePoint: true }, user)).toEqual(pipeSeq)
  })

  it('prefers an overdue CSAT over SEQ', () => {
    const user = makeUser({ lastCsatAt: daysAgo(50) })
    expect(run({ ...completion, isPausePoint: true }, user)).toEqual({
      type: 'CSAT',
    })
  })

  it('carries the pipe id into the decision', () => {
    expect(
      run(
        {
          isPausePoint: true,
          seqCandidate: { flow: 'regular', type: 'abandon', pipeId: 'pipe-1' },
        },
        makeUser({ lastCsatAt: daysAgo(1) }),
      ),
    ).toEqual({
      type: 'SEQ',
      flow: 'regular',
      trigger: 'abandon',
      pipeId: 'pipe-1',
    })
  })

  it('drops an expired abandon', () => {
    expect(
      run(
        {
          isPausePoint: true,
          seqCandidate: {
            flow: 'regular',
            type: 'abandon',
            expiresAt: daysAgo(1),
          },
        },
        makeUser({ lastCsatAt: daysAgo(1) }),
      ),
    ).toEqual({ type: 'NONE', reason: 'expired' })
  })

  it('applies the per-flow cooldown on its own', () => {
    const user = makeUser({
      lastSeqAt: { pipe: daysAgo(10), regular: null, aiBuilder: null },
    })
    expect(run(completion, user)).toEqual({
      type: 'NONE',
      reason: 'flow_cooldown',
    })
  })

  it('suppresses CSAT for new users but allows SEQ', () => {
    const user = makeUser({ signupAt: daysAgo(5) })
    expect(run(pause, user)).toEqual({ type: 'NONE', reason: 'new_user' })
    expect(run(completion, user)).toEqual(pipeSeq)
  })

  it('treats an unknown signup date as an established user', () => {
    expect(run(pause, makeUser({ signupAt: null }))).toEqual({ type: 'CSAT' })
  })

  it('does not condition CSAT on SEQ history', () => {
    const user = makeUser({
      lastSeqAt: { pipe: daysAgo(20), regular: daysAgo(20), aiBuilder: null },
    })
    expect(run(pause, user)).toEqual({ type: 'CSAT' })
  })

  it('returns NONE with no reason for a non-pause trigger without a candidate', () => {
    expect(run({ isPausePoint: false }, makeUser())).toEqual({ type: 'NONE' })
  })

  it('exempts only the publish SEQ from the gates', () => {
    expect(
      run(
        {
          isPausePoint: false,
          seqCandidate: { flow: 'regular', type: 'abandon' },
        },
        makeUser({ lastPromptAt: daysAgo(1) }),
        { config: SURVEY_CONFIG },
      ),
    ).toEqual({ type: 'NONE', reason: 'global_gate' })
  })
})

describe('after a publish SEQ, which does not start the global gate', () => {
  const user = makeUser({
    lastSeqAt: { pipe: daysAgo(0), regular: null, aiBuilder: null },
  })

  it('blocks CSAT for the rest of the session', () => {
    expect(run(pause, user, { sessionPromptShown: true })).toEqual({
      type: 'NONE',
      reason: 'session_gate',
    })
  })

  it('lets CSAT show in the next session', () => {
    expect(run(pause, user)).toEqual({ type: 'CSAT' })
  })
})

describe('checkHistory', () => {
  const csat = { type: 'CSAT' } as const
  const never = { lastRespondedAt: null, lastDismissedAt: null }

  it('waits while Confetti history loads', () => {
    expect(checkHistory(csat, undefined, SURVEY_CONFIG, NOW)).toBe('pending')
  })

  it('blocks a survey Confetti cannot serve', () => {
    expect(checkHistory(csat, null, SURVEY_CONFIG, NOW)).toBe('unavailable')
  })

  it('shows a survey the respondent never acted on', () => {
    expect(checkHistory(csat, never, SURVEY_CONFIG, NOW)).toBe('show')
  })

  it('exempts the publish SEQ from the cooldown', () => {
    expect(
      checkHistory(
        pipeSeq,
        { lastRespondedAt: NOW, lastDismissedAt: null },
        SURVEY_CONFIG,
        NOW,
      ),
    ).toBe('show')
  })
})

describe('lastActedAt', () => {
  it('returns the later of the response and the dismissal', () => {
    expect(
      lastActedAt({ lastRespondedAt: daysAgo(1), lastDismissedAt: daysAgo(3) }),
    ).toEqual(daysAgo(1))
    expect(
      lastActedAt({ lastRespondedAt: daysAgo(3), lastDismissedAt: daysAgo(1) }),
    ).toEqual(daysAgo(1))
  })
})

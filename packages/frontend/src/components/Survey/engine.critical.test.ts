/**
 * Business rules from the "Instrumentation design" Notion page and its review:
 * - CSAT: "if user closes/respond to CSAT on flows. 14 days interval"
 * - SEQ on AI Builder exit: "14 days interval"
 * - AI Builder: "ai builder should only show once every 14 days"
 * - SEQ after publish: "same as now" (every publish)
 * - SEQ after leaving a pipe: "same behaviour as ai builder. 14 days interval"
 */
import { describe, expect, it } from 'vitest'

import { SURVEY_CONFIG } from './config'
import { evaluate, SurveyTrigger, SurveyUserState } from './engine'

const NOW = new Date('2026-06-01T00:00:00Z')

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

function run(
  trigger: SurveyTrigger,
  user: SurveyUserState,
  sessionPromptShown = false,
) {
  return evaluate({
    trigger,
    user,
    sessionPromptShown,
    config: SURVEY_CONFIG,
    now: NOW,
  })
}

const dashboard: SurveyTrigger = { isPausePoint: true }
const aiBuilderExit: SurveyTrigger = {
  isPausePoint: false,
  seqCandidate: { flow: 'aiBuilder', type: 'abandon' },
}
const leftPipe: SurveyTrigger = {
  isPausePoint: true,
  seqCandidate: { flow: 'regular', type: 'abandon' },
}

describe('CSAT on the dashboard', () => {
  it('shows again 14 days after the user acted on it', () => {
    const at14 = daysAgo(14)
    expect(
      run(dashboard, makeUser({ lastCsatAt: at14, lastPromptAt: at14 })),
    ).toEqual({ type: 'CSAT' })
  })

  it('stays hidden within 14 days of the user acting on it', () => {
    const at13 = daysAgo(13)
    expect(
      run(dashboard, makeUser({ lastCsatAt: at13, lastPromptAt: at13 })),
    ).toMatchObject({ type: 'NONE' })
  })
})

describe('SEQ after publish', () => {
  it('shows on every publish', () => {
    expect(
      run(
        {
          isPausePoint: false,
          seqCandidate: { flow: 'pipe', type: 'completion' },
        },
        makeUser({
          lastPromptAt: daysAgo(0),
          lastSeqAt: { pipe: daysAgo(0), regular: null, aiBuilder: null },
        }),
        true,
      ),
    ).toEqual({ type: 'SEQ', flow: 'pipe', trigger: 'completion' })
  })
})

describe('SEQ after leaving a pipe', () => {
  const csatRecent = { lastCsatAt: daysAgo(1) }

  it('shows without sampling', () => {
    expect(run(leftPipe, makeUser(csatRecent))).toEqual({
      type: 'SEQ',
      flow: 'regular',
      trigger: 'abandon',
    })
  })

  it('shows again 14 days after the last one', () => {
    expect(
      run(
        leftPipe,
        makeUser({
          ...csatRecent,
          lastSeqAt: { pipe: null, regular: daysAgo(14), aiBuilder: null },
        }),
      ),
    ).toEqual({ type: 'SEQ', flow: 'regular', trigger: 'abandon' })
  })

  it('stays hidden within 14 days of the last one', () => {
    expect(
      run(
        leftPipe,
        makeUser({
          ...csatRecent,
          lastSeqAt: { pipe: null, regular: daysAgo(13), aiBuilder: null },
        }),
      ),
    ).toEqual({ type: 'NONE', reason: 'flow_cooldown' })
  })
})

describe('SEQ on AI Builder exit', () => {
  const expected = { type: 'SEQ', flow: 'aiBuilder', trigger: 'abandon' }

  it('shows on the first exit', () => {
    expect(run(aiBuilderExit, makeUser())).toEqual(expected)
  })

  it('shows again 14 days after the last one', () => {
    const at14 = daysAgo(14)
    expect(
      run(
        aiBuilderExit,
        makeUser({
          lastPromptAt: at14,
          lastSeqAt: { pipe: null, regular: null, aiBuilder: at14 },
        }),
      ),
    ).toEqual(expected)
  })

  it('stays hidden within 14 days of the last one', () => {
    const at13 = daysAgo(13)
    expect(
      run(
        aiBuilderExit,
        makeUser({
          lastPromptAt: at13,
          lastSeqAt: { pipe: null, regular: null, aiBuilder: at13 },
        }),
      ),
    ).toMatchObject({ type: 'NONE' })
  })

  it('stays hidden within 14 days of any other survey the user acted on', () => {
    expect(
      run(
        aiBuilderExit,
        makeUser({ lastPromptAt: daysAgo(1), lastCsatAt: daysAgo(1) }),
      ),
    ).toEqual({ type: 'NONE', reason: 'global_gate' })
  })

  it('stays hidden in a session where the user answered the publish SEQ', () => {
    expect(run(aiBuilderExit, makeUser(), true)).toEqual({
      type: 'NONE',
      reason: 'session_gate',
    })
  })
})

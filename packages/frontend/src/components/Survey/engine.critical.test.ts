/**
 * Business rules from the "Instrumentation design" Notion page:
 * - CSAT: "if user closes/respond to CSAT on flows. 14 days interval"
 * - SEQ on AI Builder exit: "14 days interval"
 * - SEQ after publish: "same as now" (every publish)
 * - SEQ after leaving a pipe: "same behaviour as ai builder. 14 days interval"
 */
import { describe, expect, it } from 'vitest'

import { SURVEY_CONFIG } from './config'
import {
  evaluate,
  isAiBuilderExitSurveyDue,
  SurveyTrigger,
  SurveyUserState,
} from './engine'

const NOW = new Date('2026-06-01T00:00:00Z')

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

function run(trigger: SurveyTrigger, user: SurveyUserState) {
  return evaluate({
    trigger,
    user,
    sessionPromptShown: false,
    config: SURVEY_CONFIG,
    now: NOW,
  })
}

const dashboard: SurveyTrigger = { isPausePoint: true }

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
      evaluate({
        trigger: {
          isPausePoint: false,
          seqCandidate: { flow: 'pipe', type: 'completion' },
        },
        user: makeUser({
          lastPromptAt: daysAgo(0),
          lastSeqAt: { pipe: daysAgo(0), regular: null },
        }),
        sessionPromptShown: true,
        config: SURVEY_CONFIG,
        now: NOW,
      }),
    ).toEqual({ type: 'SEQ', flow: 'pipe', trigger: 'completion' })
  })
})

describe('SEQ after leaving a pipe', () => {
  const leftPipe: SurveyTrigger = {
    isPausePoint: true,
    seqCandidate: { flow: 'regular', type: 'abandon' },
  }
  const csatRecent = { lastCsatAt: daysAgo(1) }

  it('shows to every user, without sampling', () => {
    for (const userId of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      expect(run(leftPipe, makeUser({ userId, ...csatRecent }))).toEqual({
        type: 'SEQ',
        flow: 'regular',
        trigger: 'abandon',
      })
    }
  })

  it('shows again 14 days after the last one', () => {
    expect(
      run(
        leftPipe,
        makeUser({ ...csatRecent, lastSeqAt: { pipe: null, regular: daysAgo(14) } }),
      ),
    ).toEqual({ type: 'SEQ', flow: 'regular', trigger: 'abandon' })
  })

  it('stays hidden within 14 days of the last one', () => {
    expect(
      run(
        leftPipe,
        makeUser({ ...csatRecent, lastSeqAt: { pipe: null, regular: daysAgo(13) } }),
      ),
    ).toEqual({ type: 'NONE', reason: 'flow_cooldown' })
  })
})

describe('SEQ on AI Builder exit', () => {
  it('shows on the first exit', () => {
    expect(isAiBuilderExitSurveyDue(null, SURVEY_CONFIG, NOW)).toBe(true)
  })

  it('shows again 14 days after the last one', () => {
    expect(isAiBuilderExitSurveyDue(daysAgo(14), SURVEY_CONFIG, NOW)).toBe(
      true,
    )
  })

  it('stays hidden within 14 days of the last one', () => {
    expect(isAiBuilderExitSurveyDue(daysAgo(13), SURVEY_CONFIG, NOW)).toBe(
      false,
    )
  })
})

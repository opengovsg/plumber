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

const aiBuilderExit: SurveyTrigger = {
  isPausePoint: false,
  seqCandidate: { flow: 'aiBuilder', type: 'abandon' },
}

// Each state mirrors what recordPrompt stores when the user acts on that survey.
describe.each([
  {
    survey: 'CSAT',
    trigger: { isPausePoint: true },
    actedOnAt: (at: Date) => ({ lastPromptAt: at, lastCsatAt: at }),
    shown: { type: 'CSAT' },
  },
  {
    survey: 'SEQ after leaving a pipe',
    trigger: {
      isPausePoint: true,
      seqCandidate: { flow: 'regular', type: 'abandon' },
    },
    actedOnAt: (at: Date) => ({
      lastPromptAt: at,
      lastCsatAt: at,
      lastSeqAt: { pipe: null, regular: at, aiBuilder: null },
    }),
    shown: { type: 'SEQ', flow: 'regular', trigger: 'abandon' },
  },
  {
    survey: 'SEQ on AI Builder exit',
    trigger: aiBuilderExit,
    actedOnAt: (at: Date) => ({
      lastPromptAt: at,
      lastSeqAt: { pipe: null, regular: null, aiBuilder: at },
    }),
    shown: { type: 'SEQ', flow: 'aiBuilder', trigger: 'abandon' },
  },
] satisfies {
  survey: string
  trigger: SurveyTrigger
  actedOnAt: (at: Date) => Partial<SurveyUserState>
  shown: object
}[])('$survey', ({ trigger, actedOnAt, shown }) => {
  it('shows again 14 days after the user acted on it', () => {
    expect(run(trigger, makeUser(actedOnAt(daysAgo(14))))).toEqual(shown)
  })

  it('stays hidden within 14 days of the user acting on it', () => {
    expect(run(trigger, makeUser(actedOnAt(daysAgo(13))))).toMatchObject({
      type: 'NONE',
    })
  })
})

describe('SEQ after publish', () => {
  it('shows on every publish, ignoring every gate', () => {
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

describe('SEQ on AI Builder exit across surveys', () => {
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

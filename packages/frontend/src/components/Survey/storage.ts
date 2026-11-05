import { z } from 'zod'

import { SURVEY_CONFIG } from './config'
import type { SeqCandidate, SeqFlow, SurveyUserState } from './engine'

// IMPORTANT: Confetti tracks history per survey only, so the cross-survey gates
// live in this browser. Per-survey history syncs in from Confetti when checked.
const STATE_KEY_PREFIX = 'plumber:survey:v1:'
const SESSION_KEY = 'plumber:survey:session'

// A corrupt or outdated field must read as "never", not as an invalid date
// that slips past every cooldown comparison.
const isoDate = z.iso.datetime().nullable().catch(null)

const PendingAbandonSchema = z.object({
  flow: z.enum(['pipe', 'regular', 'aiBuilder']),
  /** Id of the pipe being edited. Clears the abandon if the pipe is published. */
  refId: z.string(),
  expiresAt: z.iso.datetime(),
})

const StoredStateSchema = z.object({
  lastPromptAt: isoDate,
  lastCsatAt: isoDate,
  lastSeqAt: z
    .object({ pipe: isoDate, regular: isoDate, aiBuilder: isoDate })
    .catch({ pipe: null, regular: null, aiBuilder: null }),
  pendingAbandon: PendingAbandonSchema.nullable().catch(null),
})

type StoredState = z.infer<typeof StoredStateSchema>

const SessionStateSchema = z.object({
  sessionId: z.string().min(1),
  promptShown: z.boolean(),
})

type SessionState = z.infer<typeof SessionStateSchema>

function readJson(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // Surveys are best-effort and must never break the app.
  }
}

function load(userId: string): StoredState {
  const parsed = StoredStateSchema.safeParse(
    readJson(localStorage, `${STATE_KEY_PREFIX}${userId}`),
  )
  return parsed.success ? parsed.data : StoredStateSchema.parse({})
}

function save(userId: string, state: StoredState): void {
  writeJson(localStorage, `${STATE_KEY_PREFIX}${userId}`, state)
}

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null
}

export function loadUserState(
  userId: string,
  signupAt: Date | null,
): SurveyUserState {
  const state = load(userId)
  return {
    signupAt,
    lastPromptAt: toDate(state.lastPromptAt),
    lastCsatAt: toDate(state.lastCsatAt),
    lastSeqAt: {
      pipe: toDate(state.lastSeqAt.pipe),
      regular: toDate(state.lastSeqAt.regular),
      aiBuilder: toDate(state.lastSeqAt.aiBuilder),
    },
  }
}

export function recordPrompt(
  userId: string,
  survey: { type: 'csat' } | { type: 'seq'; flow: SeqFlow },
  now: Date,
  // IMPORTANT: false keeps this prompt from delaying other surveys by the
  // global cooldown. The session gate still applies.
  { startsGlobalGate = true }: { startsGlobalGate?: boolean } = {},
): void {
  const state = load(userId)
  const iso = now.toISOString()
  // History synced from Confetti can be older than what this browser holds.
  const later = (current: string | null) =>
    current && new Date(current) > now ? current : iso
  if (startsGlobalGate) {
    state.lastPromptAt = later(state.lastPromptAt)
  }
  if (survey.type === 'csat') {
    state.lastCsatAt = later(state.lastCsatAt)
  } else {
    state.lastSeqAt[survey.flow] = later(state.lastSeqAt[survey.flow])
    if (survey.flow === state.pendingAbandon?.flow) {
      state.pendingAbandon = null
    }
  }
  save(userId, state)
}

export function queueAbandon(
  userId: string,
  { flow, refId }: { flow: SeqFlow; refId: string },
  now: Date,
): void {
  const state = load(userId)
  const expiresAt = new Date(
    now.getTime() + SURVEY_CONFIG.abandonQueueExpiryHours * 60 * 60 * 1000,
  )
  state.pendingAbandon = { flow, refId, expiresAt: expiresAt.toISOString() }
  save(userId, state)
}

export function clearAbandonForRef(userId: string, refId: string): void {
  const state = load(userId)
  if (state.pendingAbandon?.refId === refId) {
    state.pendingAbandon = null
    save(userId, state)
  }
}

export function getPendingAbandon(userId: string): SeqCandidate | null {
  const { pendingAbandon } = load(userId)
  if (!pendingAbandon) {
    return null
  }
  return {
    flow: pendingAbandon.flow,
    type: 'abandon',
    expiresAt: new Date(pendingAbandon.expiresAt),
  }
}

function loadSession(): SessionState {
  const parsed = SessionStateSchema.safeParse(
    readJson(sessionStorage, SESSION_KEY),
  )
  return parsed.success
    ? parsed.data
    : { sessionId: crypto.randomUUID(), promptShown: false }
}

export function getSession(): SessionState {
  const session = loadSession()
  writeJson(sessionStorage, SESSION_KEY, session)
  return session
}

export function markSessionPromptShown(): void {
  writeJson(sessionStorage, SESSION_KEY, {
    ...loadSession(),
    promptShown: true,
  })
}

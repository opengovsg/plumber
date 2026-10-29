import { SURVEY_CONFIG } from './config'
import type { SeqCandidate, SeqFlow, SurveyUserState } from './engine'

// IMPORTANT: Confetti cannot return survey state across surveys, so this state
// lives in this browser only. The cooldowns do not follow a user across devices.
const STATE_KEY_PREFIX = 'plumber:survey:v1:'
const SESSION_KEY = 'plumber:survey:session'

interface PendingAbandon {
  abandonId: string
  flow: SeqFlow
  /** Id of the pipe being edited. Clears the abandon if the pipe is published. */
  refId: string
  expiresAt: string
}

interface StoredState {
  lastPromptAt: string | null
  lastCsatAt: string | null
  lastSeqAt: Record<SeqFlow, string | null>
  pendingAbandon: PendingAbandon | null
  aiBuilderExitSurveySeen: boolean
}

function emptyState(): StoredState {
  return {
    lastPromptAt: null,
    lastCsatAt: null,
    lastSeqAt: { pipe: null, regular: null },
    pendingAbandon: null,
    aiBuilderExitSurveySeen: false,
  }
}

function load(userId: string): StoredState {
  try {
    const raw = localStorage.getItem(`${STATE_KEY_PREFIX}${userId}`)
    if (!raw) {
      return emptyState()
    }
    const parsed = JSON.parse(raw) as Partial<StoredState>
    const base = emptyState()
    return {
      ...base,
      ...parsed,
      lastSeqAt: { ...base.lastSeqAt, ...parsed.lastSeqAt },
    }
  } catch {
    return emptyState()
  }
}

function save(userId: string, state: StoredState): void {
  try {
    localStorage.setItem(`${STATE_KEY_PREFIX}${userId}`, JSON.stringify(state))
  } catch {
    // Surveys are best-effort and must never break the app.
  }
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
    userId,
    signupAt,
    lastPromptAt: toDate(state.lastPromptAt),
    lastCsatAt: toDate(state.lastCsatAt),
    lastSeqAt: {
      pipe: toDate(state.lastSeqAt.pipe),
      regular: toDate(state.lastSeqAt.regular),
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
  if (startsGlobalGate) {
    state.lastPromptAt = iso
  }
  if (survey.type === 'csat') {
    state.lastCsatAt = iso
  } else {
    state.lastSeqAt[survey.flow] = iso
    if (survey.flow === 'regular') {
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
  state.pendingAbandon = {
    abandonId: `${refId}:${now.getTime()}`,
    flow,
    refId,
    expiresAt: expiresAt.toISOString(),
  }
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
    abandonId: pendingAbandon.abandonId,
    expiresAt: new Date(pendingAbandon.expiresAt),
  }
}

export function hasSeenAiBuilderExitSurvey(userId: string): boolean {
  return load(userId).aiBuilderExitSurveySeen
}

export function markAiBuilderExitSurveySeen(userId: string): void {
  const state = load(userId)
  state.aiBuilderExitSurveySeen = true
  save(userId, state)
}

interface SessionState {
  sessionId: string
  promptShown: boolean
}

function loadSession(): SessionState {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) {
      return JSON.parse(raw) as SessionState
    }
  } catch {
    // Fall through to a fresh in-memory session.
  }
  return { sessionId: crypto.randomUUID(), promptShown: false }
}

function saveSession(session: SessionState): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Best-effort.
  }
}

export function getSession(): SessionState {
  const session = loadSession()
  saveSession(session)
  return session
}

export function markSessionPromptShown(): void {
  saveSession({ ...loadSession(), promptShown: true })
}

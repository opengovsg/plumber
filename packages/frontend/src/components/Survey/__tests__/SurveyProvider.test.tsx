// @vitest-environment jsdom
import { useEffect } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SurveyProvider, useSurvey } from '../SurveyProvider'

const auth = vi.hoisted(() => ({
  currentUser: undefined as { id: string; createdAt: string } | undefined,
}))

vi.mock('@/hooks/useAuthentication', () => ({
  default: () => ({ currentUser: auth.currentUser }),
}))
vi.mock('@/posthog', () => ({
  default: { capture: vi.fn() },
  isPostHogConfigured: false,
}))
vi.mock('@opengovsg/confetti', () => ({
  useRespondentState: () => ({ lastRespondedAt: null, lastDismissedAt: null }),
}))
// Renders the metadata Confetti would send, so tests can read the pipe id.
vi.mock('@opengovsg/confetti/static', () => ({
  PopoverConfetti: ({ metadata }: { metadata: Record<string, string> }) => (
    <div data-testid="popover" data-pipe-id={metadata.pipe_id ?? ''} />
  ),
}))

const LONG_AGO = String(Date.UTC(2020, 0, 1))

const probe: { requestSurvey?: ReturnType<typeof useSurvey>['requestSurvey'] } =
  {}

function Probe() {
  const { requestSurvey } = useSurvey()
  useEffect(() => {
    probe.requestSurvey = requestSurvey
  }, [requestSurvey])
  return null
}

let container: HTMLDivElement
let root: Root

function render() {
  act(() => {
    root.render(
      <SurveyProvider>
        <Probe />
      </SurveyProvider>,
    )
  })
}

function publish(pipeId: string) {
  act(() => {
    probe.requestSurvey?.({
      isPausePoint: false,
      seqCandidate: { flow: 'pipe', type: 'completion', pipeId },
    })
  })
}

function shownPipeIds(): string[] {
  return [...container.querySelectorAll('[data-testid="popover"]')].map(
    (el) => el.getAttribute('data-pipe-id') ?? '',
  )
}

beforeEach(() => {
  ;(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  sessionStorage.clear()
  auth.currentUser = { id: 'user-a', createdAt: LONG_AGO }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  render()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('SurveyProvider', () => {
  it('replaces an unanswered publish SEQ with the next publish', () => {
    publish('pipe-a')
    publish('pipe-b')

    expect(shownPipeIds()).toEqual(['pipe-b'])
  })

  it('drops an open survey when another user logs in', () => {
    publish('pipe-a')
    expect(shownPipeIds()).toEqual(['pipe-a'])

    auth.currentUser = undefined
    render()
    auth.currentUser = { id: 'user-b', createdAt: LONG_AGO }
    render()

    expect(shownPipeIds()).toEqual([])
  })
})

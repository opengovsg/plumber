import './SurveyPrompt.css'
import { type FinishResult, PopoverConfetti } from '@opengovsg/confetti/static'
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import appConfig from '@/config/app'
import useAuthentication from '@/hooks/useAuthentication'
import posthog, { isPostHogConfigured } from '@/posthog'

import { SURVEY_CONFIG } from './config'
import {
  ActiveSurvey,
  evaluate,
  isAlwaysShown,
  SeqFlow,
  SurveyTrigger,
} from './engine'
import {
  clearAbandonForRef,
  getPendingAbandon,
  getSession,
  loadUserState,
  markSessionPromptShown,
  queueAbandon,
} from './storage'
import {
  parseApiTimestamp,
  recordActedOn,
  respondentFor,
  responseMetadata,
  surveyIdFor,
  surveyMetadata,
  useSurveyHistory,
} from './surveys'

interface SurveyContextParams {
  /** Evaluates the show rules and displays a survey if one is due. */
  requestSurvey: (trigger: SurveyTrigger) => void
  /** Queues a SEQ prompt for the user's next session start or dashboard return. */
  queueAbandonedSeq: (params: { flow: SeqFlow; refId: string }) => void
  /** Drops the queued abandon for a pipe the user went on to complete. */
  clearAbandonedSeq: (refId: string) => void
  /** Removes a survey that only belongs on the dashboard, once the user leaves it. */
  releaseDashboardSurvey: () => void
}

const noop = () => undefined

const SurveyContext = createContext<SurveyContextParams>({
  requestSurvey: noop,
  queueAbandonedSeq: noop,
  clearAbandonedSeq: noop,
  releaseDashboardSurvey: noop,
})

export const useSurvey = () => useContext(SurveyContext)

function capture(event: string, properties: Record<string, string>) {
  if (isPostHogConfigured) {
    posthog.capture(event, properties)
  }
}

interface ConfettiPromptProps {
  survey: ActiveSurvey
  userId: string
  onBlocked: (reason: 'unavailable' | 'cooldown') => void
  onActedOn: (
    userId: string,
    survey: ActiveSurvey,
    action: 'submitted' | 'dismissed',
  ) => void
  onClose: () => void
}

function ConfettiPrompt({
  survey,
  userId,
  onBlocked,
  onActedOn,
  onClose,
}: ConfettiPromptProps) {
  const check = useSurveyHistory(survey, userId)
  const promptRef = useRef<HTMLDivElement>(null)
  const hasActedRef = useRef(false)
  const metadata = useMemo(
    () => responseMetadata(userId, survey),
    [userId, survey],
  )

  // IMPORTANT: closing the thank-you message can unmount this prompt before
  // onFinished fires, so the action is tied to this survey, not the active one.
  const actOn = (action: 'submitted' | 'dismissed') => {
    if (!hasActedRef.current) {
      hasActedRef.current = true
      onActedOn(userId, survey, action)
    }
  }

  useEffect(() => {
    // Confetti refetches history when the tab regains focus, so the user's own
    // action here reads back as a cooldown.
    if (hasActedRef.current) {
      return
    }
    if (check === 'unavailable' || check === 'cooldown') {
      onBlocked(check)
    }
  }, [check, onBlocked])

  // The popover renders its questions after a further survey fetch, so
  // "shown" is detected from the DOM.
  useEffect(() => {
    const container = promptRef.current
    if (check !== 'show' || !container) {
      return
    }
    const observer = new MutationObserver(detect)
    function detect() {
      if (container?.querySelector('.cf-question, .cf-title')) {
        observer.disconnect()
        capture('survey_shown', surveyMetadata(survey))
      }
    }
    observer.observe(container, { childList: true, subtree: true })
    detect()
    return () => observer.disconnect()
  }, [check, survey])

  if (check !== 'show') {
    return null
  }
  return (
    <div className="confetti-survey" ref={promptRef}>
      <PopoverConfetti
        proxyUrl={appConfig.confettiApiBaseUrl}
        surveyId={surveyIdFor(survey).id}
        publishableKey={appConfig.confettiSurveyPublishableKey}
        respondent={respondentFor(userId, survey)}
        // History was already checked, so skip the widget's second fetch.
        isSurveyVisible
        metadata={metadata}
        onDismiss={() => actOn('dismissed')}
        // An undefined result means the response was not saved.
        onFinished={(result?: FinishResult) => {
          if (result) {
            actOn('submitted')
          }
        }}
        onClose={onClose}
      />
    </div>
  )
}

/** A survey on screen, tied to the user it was chosen for. */
interface ShownSurvey {
  survey: ActiveSurvey
  userId: string
}

function promptKey({ survey }: ShownSurvey): string {
  const pipeId = survey.type === 'SEQ' ? (survey.pipeId ?? '') : ''
  return `${surveyIdFor(survey).key}:${pipeId}`
}

function isPublishRequest(trigger: SurveyTrigger): boolean {
  const candidate = trigger.seqCandidate
  return (
    !!candidate &&
    isAlwaysShown(
      { type: 'SEQ', flow: candidate.flow, trigger: candidate.type },
      SURVEY_CONFIG,
    )
  )
}

export function SurveyProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuthentication()
  const [shown, setShown] = useState<ShownSurvey | null>(null)
  const shownRef = useRef<ShownSurvey | null>(null)

  const userId = currentUser?.id
  const createdAt = currentUser?.createdAt

  const show = useCallback((next: ShownSurvey | null) => {
    shownRef.current = next
    setShown(next)
  }, [])

  // IMPORTANT: logout does not reload the page, so a survey left open must not
  // carry another user's pipe id to the next user.
  useEffect(() => {
    if (shownRef.current && shownRef.current.userId !== userId) {
      show(null)
    }
  }, [userId, show])

  const requestSurvey = useCallback(
    (trigger: SurveyTrigger) => {
      if (!userId) {
        return
      }
      // Every publish gets its own survey, even over one left open.
      if (shownRef.current?.userId === userId && !isPublishRequest(trigger)) {
        return
      }
      const seqCandidate =
        trigger.seqCandidate ??
        (trigger.isPausePoint ? getPendingAbandon(userId, new Date()) : null) ??
        undefined

      const decision = evaluate({
        trigger: { ...trigger, seqCandidate },
        user: loadUserState(userId, parseApiTimestamp(createdAt)),
        sessionPromptShown: getSession(userId).promptShown,
        config: SURVEY_CONFIG,
        now: new Date(),
      })

      if (decision.type === 'NONE') {
        if (decision.reason) {
          capture('survey_suppressed', { reason: decision.reason })
        }
        return
      }
      capture('survey_eligible', surveyMetadata(decision))
      show({ survey: decision, userId })
    },
    [userId, createdAt, show],
  )

  const queueAbandonedSeq = useCallback(
    ({ flow, refId }: { flow: SeqFlow; refId: string }) => {
      if (userId) {
        queueAbandon(userId, { flow, refId }, new Date())
      }
    },
    [userId],
  )

  const clearAbandonedSeq = useCallback(
    (refId: string) => {
      if (userId) {
        clearAbandonForRef(userId, refId)
      }
    },
    [userId],
  )

  const handleBlocked = useCallback(
    (reason: 'unavailable' | 'cooldown') => {
      const survey = shownRef.current?.survey
      if (survey) {
        capture('survey_suppressed', {
          ...surveyMetadata(survey),
          reason: reason === 'cooldown' ? 'confetti_cooldown' : 'unavailable',
        })
      }
      show(null)
    },
    [show],
  )

  // IMPORTANT: cooldowns start only on a submit or a dismissal, matching
  // Confetti's history, so a survey the user ignores comes back.
  const handleActedOn = useCallback(
    (
      userId: string,
      survey: ActiveSurvey,
      action: 'submitted' | 'dismissed',
    ) => {
      recordActedOn(userId, survey, new Date())
      markSessionPromptShown(userId)
      capture(`survey_${action}`, surveyMetadata(survey))
    },
    [],
  )

  // A replaced popover can still close late, so it must not close its successor.
  const handleClose = useCallback(
    (closed: ShownSurvey) => {
      if (shownRef.current === closed) {
        show(null)
      }
    },
    [show],
  )

  const releaseDashboardSurvey = useCallback(() => {
    const survey = shownRef.current?.survey
    // The pipe completion SEQ is the only survey that belongs on another page.
    if (!survey || (survey.type === 'SEQ' && survey.trigger === 'completion')) {
      return
    }
    capture('survey_hidden', {
      ...surveyMetadata(survey),
      reason: 'left_dashboard',
    })
    show(null)
  }, [show])

  const value = useMemo(
    () => ({
      requestSurvey,
      queueAbandonedSeq,
      clearAbandonedSeq,
      releaseDashboardSurvey,
    }),
    [
      requestSurvey,
      queueAbandonedSeq,
      clearAbandonedSeq,
      releaseDashboardSurvey,
    ],
  )

  return (
    <SurveyContext.Provider value={value}>
      {children}
      {shown && shown.userId === userId && (
        <ConfettiPrompt
          key={promptKey(shown)}
          survey={shown.survey}
          userId={shown.userId}
          onBlocked={handleBlocked}
          onActedOn={handleActedOn}
          onClose={() => handleClose(shown)}
        />
      )}
    </SurveyContext.Provider>
  )
}

import './SurveyPrompt.css'
import { PopoverConfetti } from '@opengovsg/confetti/static'
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
  recordPrompt,
} from './storage'
import {
  parseApiTimestamp,
  respondentFor,
  responseMetadata,
  surveyIdFor,
  surveyMetadata,
} from './surveys'

const THANK_YOU_VISIBLE_MS = 3000

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

export function SurveyProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuthentication()
  const [active, setActive] = useState<ActiveSurvey | null>(null)
  const activeRef = useRef<ActiveSurvey | null>(null)
  const hasShownRef = useRef(false)
  const hasEngagedRef = useRef(false)
  const promptRef = useRef<HTMLDivElement>(null)

  const userId = currentUser?.id
  const createdAt = currentUser?.createdAt

  const requestSurvey = useCallback(
    (trigger: SurveyTrigger) => {
      if (!userId || activeRef.current) {
        return
      }
      const now = new Date()
      const seqCandidate =
        trigger.seqCandidate ??
        (trigger.isPausePoint ? getPendingAbandon(userId) : null) ??
        undefined
      const resolvedTrigger = { ...trigger, seqCandidate }

      const decision = evaluate({
        trigger: resolvedTrigger,
        user: loadUserState(userId, parseApiTimestamp(createdAt)),
        sessionPromptShown: getSession().promptShown,
        config: SURVEY_CONFIG,
        now,
      })

      if (decision.type === 'NONE') {
        if (decision.reason) {
          capture('survey_suppressed', { reason: decision.reason })
        }
        return
      }
      capture('survey_eligible', surveyMetadata(decision))
      activeRef.current = decision
      hasShownRef.current = false
      hasEngagedRef.current = false
      setActive(decision)
    },
    [userId, createdAt],
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

  // Confetti's isSurveyVisible fires before the survey loads, so the shown
  // state is detected from rendered questions.
  const handleShown = useCallback((survey: ActiveSurvey) => {
    if (hasShownRef.current) {
      return
    }
    hasShownRef.current = true
    capture('survey_shown', surveyMetadata(survey))
  }, [])

  // IMPORTANT: cooldowns start only once the user acts on the panel, so a survey
  // they ignore keeps coming back on the dashboard.
  const handleEngaged = useCallback(
    (survey: ActiveSurvey) => {
      if (!userId || hasEngagedRef.current) {
        return
      }
      hasEngagedRef.current = true
      const startsGlobalGate = !(
        survey.type === 'SEQ' &&
        isAlwaysShown(
          { flow: survey.flow, type: survey.trigger },
          SURVEY_CONFIG,
        )
      )
      recordPrompt(
        userId,
        survey.type === 'CSAT'
          ? { type: 'csat' }
          : { type: 'seq', flow: survey.flow },
        new Date(),
        { startsGlobalGate },
      )
      markSessionPromptShown()
      capture('survey_engaged', surveyMetadata(survey))
    },
    [userId],
  )

  useEffect(() => {
    const container = promptRef.current
    if (!active || !container) {
      return
    }
    const observer = new MutationObserver(check)
    function check() {
      if (container?.querySelector('.cf-question, .cf-title') && active) {
        observer.disconnect()
        handleShown(active)
      }
    }
    observer.observe(container, { childList: true, subtree: true })
    check()

    const engage = () => handleEngaged(active)
    container.addEventListener('pointerdown', engage, true)
    container.addEventListener('keydown', engage, true)
    return () => {
      observer.disconnect()
      container.removeEventListener('pointerdown', engage, true)
      container.removeEventListener('keydown', engage, true)
    }
  }, [active, handleShown, handleEngaged])

  const handleDismiss = useCallback(
    (survey: ActiveSurvey) => {
      handleEngaged(survey)
      capture('survey_dismissed', surveyMetadata(survey))
      activeRef.current = null
      setActive(null)
    },
    [handleEngaged],
  )

  // The widget keeps its thank-you message up until the user closes it, which
  // would otherwise follow them to the next page.
  const handleFinished = useCallback((survey: ActiveSurvey) => {
    window.setTimeout(() => {
      if (activeRef.current === survey) {
        activeRef.current = null
        setActive(null)
      }
    }, THANK_YOU_VISIBLE_MS)
  }, [])

  const releaseDashboardSurvey = useCallback(() => {
    const survey = activeRef.current
    // The pipe completion SEQ is the only survey that belongs on another page.
    if (!survey || (survey.type === 'SEQ' && survey.trigger === 'completion')) {
      return
    }
    capture('survey_hidden', {
      ...surveyMetadata(survey),
      reason: 'left_dashboard',
    })
    activeRef.current = null
    setActive(null)
  }, [])

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
      {active && userId && (
        <div className="confetti-survey" ref={promptRef}>
          <PopoverConfetti
            key={surveyIdFor(active).key}
            proxyUrl={appConfig.confettiApiBaseUrl}
            surveyId={surveyIdFor(active).id}
            publishableKey={appConfig.confettiSurveyPublishableKey}
            respondent={respondentFor(userId, active)}
            onDismiss={() => handleDismiss(active)}
            onFinished={() => handleFinished(active)}
            metadata={responseMetadata(active)}
          />
        </div>
      )}
    </SurveyContext.Provider>
  )
}

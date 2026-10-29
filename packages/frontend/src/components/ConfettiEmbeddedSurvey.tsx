import './ConfettiEmbeddedSurvey.css'
import { Box, Skeleton, VStack } from '@chakra-ui/react'
import {
  ConfettiController,
  ConfettiProvider,
  SurveyQuestionFactory,
} from '@opengovsg/confetti/components'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import {
  isReadyToSubmit,
  resolveSubmit,
} from './ConfettiEmbeddedSurvey.helpers'

// How long to wait for the survey before treating it as unavailable and
// letting the caller submit without it.
const SURVEY_LOAD_TIMEOUT_MS = 5000

export interface ConfettiEmbeddedSurveyRef {
  /**
   * Submits the survey, unless a question marked required in Confetti is
   * unanswered. Returns whether it submitted, so the caller can keep the user
   * on the survey.
   */
  submitIfComplete: () => boolean
  /** Whether the survey rendered, as opposed to timing out unseen. */
  hasLoaded: () => boolean
}

interface ConfettiEmbeddedSurveyProps {
  surveyId: string
  publishableKey: string
  apiBaseUrl?: string
  respondent?: string
  metadata?: Record<string, string>
  onReadyToSubmitChange?: (isReady: boolean) => void
}

// ConfettiController renders nothing until the survey has loaded, so this
// only ever mounts once questions are ready to show.
function NotifyLoaded({ onLoaded }: { onLoaded: () => void }) {
  useLayoutEffect(() => {
    onLoaded()
  }, [onLoaded])
  return null
}

const ConfettiEmbeddedSurvey = forwardRef<
  ConfettiEmbeddedSurveyRef,
  ConfettiEmbeddedSurveyProps
>(
  (
    {
      surveyId,
      publishableKey,
      apiBaseUrl,
      respondent,
      metadata,
      onReadyToSubmitChange,
    },
    ref,
  ) => {
    const submitRef = useRef<() => boolean>()
    const [isLoaded, setIsLoaded] = useState(false)
    const [hasLoadTimedOut, setHasLoadTimedOut] = useState(false)

    useEffect(() => {
      if (isLoaded) {
        return
      }
      const timer = window.setTimeout(() => {
        setHasLoadTimedOut(true)
      }, SURVEY_LOAD_TIMEOUT_MS)
      return () => window.clearTimeout(timer)
    }, [isLoaded])

    useEffect(() => {
      onReadyToSubmitChange?.(isReadyToSubmit({ isLoaded, hasLoadTimedOut }))
    }, [isLoaded, hasLoadTimedOut, onReadyToSubmitChange])

    useImperativeHandle(ref, () => ({
      hasLoaded: () => isLoaded,
      submitIfComplete: () =>
        resolveSubmit({ isLoaded, hasLoadTimedOut, submit: submitRef.current }),
    }))

    return (
      <div className="confetti-embedded-survey">
        {!isLoaded && (
          <VStack align="stretch" gap={5}>
            <Skeleton height="16px" width="60%" borderRadius="base" />
            <Skeleton height="40px" borderRadius="base" />
          </VStack>
        )}
        <Box display={isLoaded ? 'block' : 'none'}>
          <ConfettiProvider
            surveyId={surveyId}
            publishableKey={publishableKey}
            apiBaseUrl={apiBaseUrl}
            respondent={respondent}
            metadata={metadata}
          >
            <ConfettiController>
              {({ questions, update, errors, submit }) => {
                submitRef.current = submit
                return (
                  <>
                    <NotifyLoaded onLoaded={() => setIsLoaded(true)} />
                    {questions
                      .filter((question) => question.visible)
                      .map((question) => (
                        <SurveyQuestionFactory
                          key={question.id}
                          question={question}
                          error={errors[question.id]}
                          onChange={(answer) =>
                            update({ question: question.position, answer })
                          }
                        />
                      ))}
                  </>
                )
              }}
            </ConfettiController>
          </ConfettiProvider>
        </Box>
      </div>
    )
  },
)
ConfettiEmbeddedSurvey.displayName = 'ConfettiEmbeddedSurvey'

export default ConfettiEmbeddedSurvey

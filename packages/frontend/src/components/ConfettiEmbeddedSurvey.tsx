import './ConfettiEmbeddedSurvey.css'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Box, Skeleton, Text, VStack } from '@chakra-ui/react'
import {
  Answer,
  ConfettiController,
  ConfettiProvider,
  Question,
  SurveyQuestionFactory,
} from '@opengovsg/confetti'

import {
  decideSubmit,
  resolveQuestionError,
  SurveyCompleteness,
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
}

interface ConfettiEmbeddedSurveyProps {
  surveyId: string
  publishableKey: string
  apiBaseUrl?: string
  respondent?: string
  metadata?: Record<string, string>
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
>(({ surveyId, publishableKey, apiBaseUrl, respondent, metadata }, ref) => {
  const submitRef = useRef<() => void>()
  const completenessRef = useRef<SurveyCompleteness>(null)
  const answersRef = useRef<Record<Question['id'], Answer>>({})
  const hasLoadTimedOutRef = useRef(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false)

  useEffect(() => {
    if (isLoaded) {
      return
    }
    const timer = window.setTimeout(() => {
      hasLoadTimedOutRef.current = true
    }, SURVEY_LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [isLoaded])

  useImperativeHandle(ref, () => ({
    submitIfComplete: () => {
      const decision = decideSubmit({
        completeness: completenessRef.current,
        hasLoadTimedOut: hasLoadTimedOutRef.current,
      })
      if (decision !== 'submit') {
        setHasTriedSubmit(true)
        return false
      }
      submitRef.current?.()
      return true
    },
  }))

  return (
    <div className="confetti-embedded-survey">
      {!isLoaded && (
        <VStack align="stretch" gap={5}>
          <Skeleton height="16px" width="60%" borderRadius="base" />
          <Skeleton height="40px" borderRadius="base" />
          {hasTriedSubmit && (
            <Text textStyle="body-2">
              The survey is still loading. Please try again in a moment.
            </Text>
          )}
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
            {({ questions, update, errors, submit, isCompleted }) => {
              submitRef.current = submit
              completenessRef.current = isCompleted
              return (
                <>
                  <NotifyLoaded onLoaded={() => setIsLoaded(true)} />
                  {questions
                    .filter((question) => question.visible)
                    .map((question) => (
                      <SurveyQuestionFactory
                        key={question.id}
                        question={question}
                        error={resolveQuestionError({
                          question,
                          error: errors[question.id],
                          answer: answersRef.current[question.id],
                          hasTriedSubmit,
                        })}
                        onChange={(answer: Answer) => {
                          answersRef.current[question.id] = answer
                          update({ question: question.position, answer })
                        }}
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
})
ConfettiEmbeddedSurvey.displayName = 'ConfettiEmbeddedSurvey'

export default ConfettiEmbeddedSurvey

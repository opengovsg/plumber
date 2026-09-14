import './ConfettiEmbeddedSurvey.css'

import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Box, Skeleton, VStack } from '@chakra-ui/react'
import {
  Answer,
  ConfettiController,
  ConfettiProvider,
  Question,
  SurveyQuestionFactory,
} from '@opengovsg/confetti'

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

// Confetti reports an unanswered required rating as "Invalid input", which
// reads like a broken widget rather than a skipped question.
const MISSING_ANSWER_ERROR = 'This field is required'

// ConfettiController renders nothing until the survey has loaded, so this
// only ever mounts once questions are ready to show.
function NotifyLoaded({ onLoaded }: { onLoaded: () => void }) {
  useLayoutEffect(() => {
    onLoaded()
  }, [onLoaded])
  return null
}

function isAnswered(answer: Answer | undefined): boolean {
  if (answer === undefined || answer === null) {
    return false
  }
  if (typeof answer === 'string') {
    return answer.trim().length > 0
  }
  if (Array.isArray(answer)) {
    return answer.length > 0
  }
  return true
}

const ConfettiEmbeddedSurvey = forwardRef<
  ConfettiEmbeddedSurveyRef,
  ConfettiEmbeddedSurveyProps
>(({ surveyId, publishableKey, apiBaseUrl, respondent, metadata }, ref) => {
  const submitRef = useRef<() => void>()
  // Confetti's own "every required question is answered" verdict. Stays null
  // until the survey renders, so a survey that never loads can't lock the
  // caller out of submitting.
  const isCompletedRef = useRef<boolean | null>(null)
  const answersRef = useRef<Record<Question['id'], Answer>>({})
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false)

  useImperativeHandle(ref, () => ({
    submitIfComplete: () => {
      if (isCompletedRef.current === false) {
        setHasTriedSubmit(true)
        return false
      }
      submitRef.current?.()
      return true
    },
  }))

  // Confetti validates each question as it mounts, so every unanswered
  // required question starts out errored. Withhold that until a submit.
  const resolveError = (question: Question, error: string | undefined) => {
    if (!hasTriedSubmit) {
      return undefined
    }
    if (question.required && !isAnswered(answersRef.current[question.id])) {
      return MISSING_ANSWER_ERROR
    }
    return error
  }

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
            {({ questions, update, errors, submit, isCompleted }) => {
              submitRef.current = submit
              isCompletedRef.current = isCompleted
              return (
                <>
                  <NotifyLoaded onLoaded={() => setIsLoaded(true)} />
                  {questions
                    .filter((question) => question.visible)
                    .map((question) => (
                      <SurveyQuestionFactory
                        key={question.id}
                        question={question}
                        error={resolveError(question, errors[question.id])}
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

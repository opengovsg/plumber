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
  SurveyQuestionFactory,
} from '@opengovsg/confetti'

export interface ConfettiEmbeddedSurveyRef {
  submit: () => void
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
  const [isLoaded, setIsLoaded] = useState(false)

  useImperativeHandle(ref, () => ({
    submit: () => submitRef.current?.(),
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
                        onChange={(answer: Answer) =>
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
})
ConfettiEmbeddedSurvey.displayName = 'ConfettiEmbeddedSurvey'

export default ConfettiEmbeddedSurvey

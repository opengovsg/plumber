import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Text,
} from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'
import { useRef, useState } from 'react'

import ConfettiEmbeddedSurvey, {
  ConfettiEmbeddedSurveyRef,
} from '@/components/ConfettiEmbeddedSurvey'
import { SURVEY_CONFIG } from '@/components/Survey/config'
import { ActiveSurvey, evaluate } from '@/components/Survey/engine'
import {
  getSession,
  loadUserState,
  markSessionPromptShown,
} from '@/components/Survey/storage'
import {
  parseApiTimestamp,
  recordActedOn,
  respondentFor,
  responseMetadata,
  surveyIdFor,
  useSurveyHistory,
} from '@/components/Survey/surveys'
import appConfig from '@/config/app'
import useAuthentication from '@/hooks/useAuthentication'

interface ExitAlertProps {
  cancelRef: React.RefObject<HTMLButtonElement>
  isOpen: boolean
  onClose: () => void
  onExit: () => void
}

const defaultStyles = {
  ml: 6 /* Add spacing from the left edge */,
  my: 6 /* Remove default vertical margins */,
  maxW: '514px' /* Set a maximum width */,
  w: '100%' /* Ensure it takes full width */,
}

const AI_BUILDER_SURVEY: ActiveSurvey = {
  type: 'SEQ',
  flow: 'aiBuilder',
  trigger: 'abandon',
}

const mobileStyles = {
  maxW: '300px' /* Set a maximum width */,
  w: '100%' /* Ensure it takes full width */,
}

export default function ExitAlert({
  cancelRef,
  isOpen,
  onClose,
  onExit,
}: ExitAlertProps) {
  const isMobile = useIsMobile()
  const contentStyles = isMobile ? mobileStyles : defaultStyles
  const confettiRef = useRef<ConfettiEmbeddedSurveyRef>(null)
  const [isReadyToSubmit, setIsReadyToSubmit] = useState(false)
  const { currentUser } = useAuthentication()
  const userId = currentUser?.id
  const history = useSurveyHistory(AI_BUILDER_SURVEY, userId)
  // Decided when the dialog first opens, so the survey cannot vanish mid-dialog.
  const [survey, setSurvey] = useState<ActiveSurvey | null | undefined>()

  function decideSurvey(): ActiveSurvey | null {
    // A pending history check falls back to local state alone.
    if (!userId || history === 'unavailable' || history === 'cooldown') {
      return null
    }
    const decision = evaluate({
      trigger: {
        isPausePoint: false,
        seqCandidate: { flow: 'aiBuilder', type: 'abandon' },
      },
      user: loadUserState(userId, parseApiTimestamp(currentUser?.createdAt)),
      sessionPromptShown: getSession().promptShown,
      config: SURVEY_CONFIG,
      now: new Date(),
    })
    return decision.type === 'NONE' ? null : decision
  }
  if (isOpen && survey === undefined) {
    setSurvey(decideSurvey())
  }
  const shouldShowSurvey = !!survey

  const handleExit = () => {
    if (survey && userId) {
      const hasSubmitted = confettiRef.current?.submitIfComplete() ?? false
      if (!hasSubmitted) {
        return
      }
      // A survey that timed out unseen must not start cooldowns.
      if (confettiRef.current?.hasLoaded()) {
        recordActedOn(userId, survey, new Date())
        markSessionPromptShown()
      }
    }
    // Fire-and-forget: exiting must never block on the survey network call.
    onExit?.()
    onClose()
  }

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
    >
      <AlertDialogOverlay
        display="flex"
        alignItems="flex-start"
        justifyContent="flex-start"
      >
        <AlertDialogContent borderRadius={8} {...contentStyles}>
          <AlertDialogHeader px={6} pt={6} pb={2}>
            <Text textStyle="h5">Your progress will be lost if you exit</Text>
          </AlertDialogHeader>
          <AlertDialogBody
            px={6}
            py={0}
            gap={5}
            display="flex"
            flexDirection="column"
          >
            <Text textStyle="body-2" color="base.content.medium">
              We don&apos;t save chats or pipe drafts, so they&apos;ll be gone
              once you leave.
              {shouldShowSurvey &&
                " Before you go, we'd love a quick rating. It takes 5 seconds."}
            </Text>
            {survey && userId && (
              <ConfettiEmbeddedSurvey
                ref={confettiRef}
                surveyId={surveyIdFor(survey).id}
                publishableKey={appConfig.confettiSurveyPublishableKey}
                apiBaseUrl={appConfig.confettiApiBaseUrl}
                respondent={respondentFor(userId, survey)}
                isSurveyVisible
                metadata={responseMetadata(survey)}
                onReadyToSubmitChange={setIsReadyToSubmit}
              />
            )}
          </AlertDialogBody>
          <AlertDialogFooter
            display="flex"
            flexDirection={isMobile ? 'column-reverse' : 'row'}
            gap={2}
            pt={6}
            pb={6}
            px={6}
          >
            <Button
              ref={cancelRef}
              variant="clear"
              colorScheme="secondary"
              w={isMobile ? '100%' : undefined}
              onClick={onClose}
            >
              Stay on page
            </Button>
            <Button
              colorScheme="critical"
              w={isMobile ? '100%' : undefined}
              isDisabled={shouldShowSurvey && !isReadyToSubmit}
              onClick={handleExit}
            >
              {shouldShowSurvey ? 'Submit and exit' : 'Exit anyway'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}

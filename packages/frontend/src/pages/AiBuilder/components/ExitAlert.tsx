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
import { useRef } from 'react'

import ConfettiEmbeddedSurvey, {
  ConfettiEmbeddedSurveyRef,
} from '@/components/ConfettiEmbeddedSurvey'
import appConfig from '@/config/app'
import useAuthentication from '@/hooks/useAuthentication'

import { useAiBuilderContext } from '../AiBuilderContext'

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
  const { chatId } = useAiBuilderContext()
  const { currentUser } = useAuthentication()
  const userEmail = currentUser?.email ?? 'unknown-user'

  const handleExit = () => {
    // Fire-and-forget: exiting must never block on the survey network call.
    confettiRef.current?.submit()
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
          <AlertDialogHeader p={6}>
            <Text textStyle="h5">Your progress will be lost if you exit</Text>
          </AlertDialogHeader>
          <AlertDialogBody gap={5} display="flex" flexDirection="column">
            <Text textStyle="subhead-1">
              Please take 5 seconds to help the Plumber team
            </Text>
            <ConfettiEmbeddedSurvey
              ref={confettiRef}
              surveyId={appConfig.confettiAiBuilderSurveyId}
              publishableKey={appConfig.confettiSurveyPublishableKey}
              apiBaseUrl={appConfig.confettiApiBaseUrl}
              respondent={`${userEmail}-${chatId}`}
            />
          </AlertDialogBody>
          <AlertDialogFooter
            display="flex"
            flexDirection="row"
            gap={2}
            pt={6}
            pb={6}
            px={6}
          >
            <Button
              ref={cancelRef}
              variant="clear"
              colorScheme="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button colorScheme="critical" onClick={handleExit}>
              Submit and exit
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}

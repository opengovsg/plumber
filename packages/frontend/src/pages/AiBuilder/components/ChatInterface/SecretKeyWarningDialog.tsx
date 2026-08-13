import { RefObject } from 'react'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

interface SecretKeyWarningDialogProps {
  cancelRef: RefObject<HTMLButtonElement>
  isOpen: boolean
  onClose: () => void
  onSendAnyway: () => void
}

export default function SecretKeyWarningDialog({
  cancelRef,
  isOpen,
  onClose,
  onSendAnyway,
}: SecretKeyWarningDialogProps) {
  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>
            This message appears to contain a secret key
          </AlertDialogHeader>
          <AlertDialogBody>
            Secret keys and API keys should only be entered via the app&apos;s
            own connection setup, never in chat — chat messages are sent to the
            AI. Are you sure you want to send this?
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button
              colorScheme="neutral"
              variant="clear"
              ref={cancelRef}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button colorScheme="critical" onClick={onSendAnyway} ml={3}>
              Send anyway
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}

import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import { RefObject } from 'react'

interface SecretKeyWarningDialogProps {
  cancelRef: RefObject<HTMLButtonElement>
  isOpen: boolean
  isFormsgKey: boolean
  onClose: () => void
  onSendAnyway: () => void
  onRemoveKeyAndSend: () => void
  /** Only set once the pipe exists, since a connection needs a flow. */
  onConnectSecurely?: () => void
}

export default function SecretKeyWarningDialog({
  cancelRef,
  isOpen,
  isFormsgKey,
  onClose,
  onSendAnyway,
  onRemoveKeyAndSend,
  onConnectSecurely,
}: SecretKeyWarningDialogProps) {
  const body = !isFormsgKey
    ? "Secret keys and API keys should only be entered via the app's own connection setup, never in chat — chat messages are sent to the AI. Are you sure you want to send this?"
    : onConnectSecurely
      ? 'Chat messages are sent to the AI. Connect your form securely instead. Your key goes only to Plumber, never to the AI.'
      : 'Chat messages are sent to the AI. Plumber asks for your secret key in a secure form after it creates your workflow.'

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>
            {isFormsgKey
              ? 'Do not send your form secret key in chat'
              : 'This message appears to contain a secret key'}
          </AlertDialogHeader>
          <AlertDialogBody>{body}</AlertDialogBody>
          <AlertDialogFooter>
            <Button
              colorScheme="neutral"
              variant="clear"
              ref={cancelRef}
              onClick={onClose}
            >
              Cancel
            </Button>
            {isFormsgKey ? (
              <>
                <Button
                  variant={onConnectSecurely ? 'outline' : 'solid'}
                  onClick={onRemoveKeyAndSend}
                  ml={3}
                >
                  Remove key and send
                </Button>
                {onConnectSecurely && (
                  <Button onClick={onConnectSecurely} ml={3}>
                    Connect securely
                  </Button>
                )}
              </>
            ) : (
              <Button colorScheme="critical" onClick={onSendAnyway} ml={3}>
                Send anyway
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}

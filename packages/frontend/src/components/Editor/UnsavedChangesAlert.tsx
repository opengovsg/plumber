import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
} from '@chakra-ui/react'

export interface UnsavedChangesAlertProps {
  cancelRef: React.RefObject<HTMLButtonElement>
  isOpen: boolean
  onClose: () => void
  onLeave?: () => void
  onStay?: () => void
}

export default function UnsavedChangesAlert({
  cancelRef,
  isOpen,
  onClose,
  onLeave,
  onStay,
}: UnsavedChangesAlertProps): React.ReactElement {
  const handleLeave = () => {
    onLeave?.()
    onClose()
  }

  const handleStay = () => {
    onStay?.()
    onClose()
  }

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>You have unsaved changes</AlertDialogHeader>

          <AlertDialogBody>
            Are you sure you want to leave? Your changes will be lost.
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button
              ref={cancelRef}
              onClick={handleStay}
              variant="clear"
              colorScheme="secondary"
            >
              Continue editing
            </Button>
            <Button colorScheme="critical" onClick={handleLeave} ml={3}>
              Discard changes
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}

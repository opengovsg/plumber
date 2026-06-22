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
}

export default function UnsavedChangesAlert({
  cancelRef,
  isOpen,
  onClose,
  onLeave,
}: UnsavedChangesAlertProps): React.ReactElement {
  const handleLeave = () => {
    onLeave?.()
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
              onClick={handleLeave}
              variant="clear"
              colorScheme="secondary"
            >
              Discard changes
            </Button>
            <Button ref={cancelRef} onClick={onClose} ml={3}>
              Continue editing
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}

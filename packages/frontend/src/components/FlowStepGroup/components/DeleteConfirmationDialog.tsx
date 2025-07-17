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

interface DeleteConfirmationDialogProps {
  cancelRef: RefObject<HTMLButtonElement>
  name: string
  isOpen: boolean
  onClose: () => void
  onCancel: () => void
  onDelete: () => void
}

export default function DeleteConfirmationDialog(
  props: DeleteConfirmationDialogProps,
) {
  const { cancelRef, name, isOpen, onClose, onDelete, onCancel } = props
  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>Delete {name}</AlertDialogHeader>
          <AlertDialogBody>
            Are you sure you want to delete {name}? This action cannot be
            undone.
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button
              colorScheme="neutral"
              variant="clear"
              ref={cancelRef}
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button colorScheme="critical" onClick={onDelete} ml={3}>
              Yes, delete {name}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}

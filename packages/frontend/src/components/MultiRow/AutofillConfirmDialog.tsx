import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import type { AutofillConfirmState } from './useAutofill'

type AutofillConfirmDialogProps = {
  confirm: AutofillConfirmState
}

export default function AutofillConfirmDialog({
  confirm: { isOpen, cancelRef, onClose, onConfirm },
}: AutofillConfirmDialogProps): JSX.Element {
  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>Autofill rows</AlertDialogHeader>
          <AlertDialogBody>
            Autofill will replace all existing rows below. This cannot be
            undone.
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
            <Button onClick={onConfirm} ml={3}>
              Yes, autofill
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}

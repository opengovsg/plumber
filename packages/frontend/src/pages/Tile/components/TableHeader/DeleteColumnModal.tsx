import { useCallback, useRef } from 'react'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { useUpdateTable } from '../../hooks/useUpdateTable'

interface DeleteColumnModalProps {
  columnName: string
  columnId: string
  onClose: () => void
}

export default function DeleteColumnModal({
  columnName,
  columnId,
  onClose,
}: DeleteColumnModalProps) {
  const cancelRef = useRef(null)
  const { deleteColumns, isDeletingColumns } = useUpdateTable()

  const onDelete = useCallback(async () => {
    await deleteColumns([columnId])
    onClose()
  }, [onClose, deleteColumns, columnId])

  return (
    <AlertDialog
      isOpen={true}
      leastDestructiveRef={cancelRef}
      motionPreset="none"
      onClose={onClose}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>Delete Column</AlertDialogHeader>

          <AlertDialogBody>
            Are you sure you want to delete column: <b>{columnName}</b>?
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button
              colorScheme="secondary"
              variant="clear"
              ref={cancelRef}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              colorScheme="critical"
              onClick={onDelete}
              ml={3}
              isLoading={isDeletingColumns}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}

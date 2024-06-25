import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Progress,
  Text,
} from '@chakra-ui/react'
import { chunk } from 'lodash'

import { useTableContext } from '../../contexts/TableContext'
import { useDeleteRows } from '../../hooks/useDeleteRows'

const CHUNK_SIZE = 100

interface DeleteRowsModalProps {
  rowIdsToDelete: string[]
  removeRows: (rowIds: string[]) => void
  onClose: () => void
}

export default function DeleteRowsModal({
  rowIdsToDelete,
  removeRows,
  onClose,
}: DeleteRowsModalProps) {
  const { mode } = useTableContext()
  const isViewMode = mode === 'view'

  const cancelRef = useRef(null)
  const { deleteRows, rowsDeleting } = useDeleteRows()
  const [numDeletedRows, setNumDeletedRows] = useState(0)
  const [numRowsToDelete, setNumRowsToDelete] = useState(0)
  const [isDeletingRows, setIsDeletingRows] = useState(false)

  const onDelete = useCallback(async () => {
    setIsDeletingRows(true)
    const chunks = chunk(rowIdsToDelete, CHUNK_SIZE)
    for (const chunk of chunks) {
      await deleteRows(chunk)
      setNumDeletedRows((prev) => prev + chunk.length)
      removeRows(chunk)
    }
    setTimeout(() => {
      onClose()
    }, 1000)
  }, [deleteRows, onClose, removeRows, rowIdsToDelete])

  useEffect(() => {
    setIsDeletingRows(false)
    setNumDeletedRows(0)
    setNumRowsToDelete(rowIdsToDelete.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isViewMode) {
    return null
  }

  return (
    <AlertDialog
      motionPreset="none"
      isOpen={true}
      leastDestructiveRef={cancelRef}
      trapFocus={false}
      closeOnOverlayClick={!isDeletingRows}
      onClose={onClose}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>Delete rows</AlertDialogHeader>

          <AlertDialogBody>
            {isDeletingRows ? (
              <>
                <Text>
                  Deleting rows ({numDeletedRows} / {numRowsToDelete})
                </Text>
                <Progress value={numDeletedRows} max={numRowsToDelete} mt={4} />
              </>
            ) : (
              <Text>
                Are you sure you want to delete <b>{numRowsToDelete}</b> row
                {numRowsToDelete > 1 ? 's' : ''}?
              </Text>
            )}
          </AlertDialogBody>

          <AlertDialogFooter>
            {!isDeletingRows && (
              <Button
                colorScheme="secondary"
                variant="clear"
                ref={cancelRef}
                onClick={onClose}
              >
                Cancel
              </Button>
            )}
            <Button
              colorScheme="critical"
              onClick={onDelete}
              ml={3}
              isDisabled={isDeletingRows}
              isLoading={!!rowsDeleting}
            >
              {isDeletingRows ? 'Done' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}

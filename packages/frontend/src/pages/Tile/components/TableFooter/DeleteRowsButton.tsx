import { useCallback, useRef, useState } from 'react'
import { BsTrash } from 'react-icons/bs'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
} from '@chakra-ui/react'
import { ROW_HEIGHT } from 'pages/Tile/constants'

import { useDeleteRows } from '../../hooks/useDeleteRows'

interface DeleteRowsButtonProps {
  rowSelection: Record<string, boolean>
  removeRows: (rows: string[]) => void
}

export default function DeleteRowsButton({
  rowSelection,
  removeRows,
}: DeleteRowsButtonProps) {
  const rowsSelected = Object.keys(rowSelection)
  const cancelRef = useRef(null)
  const { deleteRows, rowsDeleting } = useDeleteRows()

  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const onDelete = useCallback(async () => {
    await deleteRows(rowsSelected)
    removeRows(rowsSelected)
    setIsDialogOpen(false)
  }, [deleteRows, removeRows, rowsSelected])

  return (
    <div
      style={{
        height: ROW_HEIGHT.FOOTER,
        maxHeight: ROW_HEIGHT.FOOTER,
        overflow: 'visible',
        visibility: rowsSelected.length ? 'visible' : 'hidden',
      }}
    >
      <Button
        variant="clear"
        size="xs"
        h="100%"
        leftIcon={<BsTrash />}
        onClick={() => setIsDialogOpen(true)}
      >
        Delete
      </Button>
      <AlertDialog
        motionPreset="none"
        isOpen={isDialogOpen}
        leastDestructiveRef={cancelRef}
        trapFocus={false}
        onClose={() => setIsDialogOpen(false)}
      >
        <AlertDialogOverlay bg="none" backdropFilter="auto" backdropBlur="2px">
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Column
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to <b>{rowsSelected.length}</b> row
              {rowsSelected.length > 1 ? 's' : ''}?
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button
                colorScheme="secondary"
                variant="clear"
                ref={cancelRef}
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={onDelete}
                ml={3}
                isLoading={!!rowsDeleting}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </div>
  )
}

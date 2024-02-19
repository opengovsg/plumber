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
  Progress,
  Text,
} from '@chakra-ui/react'
import { chunk } from 'lodash'
import { ROW_HEIGHT } from 'pages/Tile/constants'

import { useTableContext } from '../../contexts/TableContext'
import { useDeleteRows } from '../../hooks/useDeleteRows'

const CHUNK_SIZE = 100

interface DeleteRowsButtonProps {
  rowSelection: Record<string, boolean>
  removeRows: (rowIds: string[]) => void
}

export default function DeleteRowsButton({
  rowSelection,
  removeRows,
}: DeleteRowsButtonProps) {
  const { mode } = useTableContext()
  const isViewMode = mode === 'view'

  const rowsSelected = Object.keys(rowSelection)
  const cancelRef = useRef(null)
  const { deleteRows, rowsDeleting } = useDeleteRows()
  const [numDeletedRows, setNumDeletedRows] = useState(0)
  const [numRowsToDelete, setNumRowsToDelete] = useState(0)
  const [isDeletingRows, setIsDeletingRows] = useState(false)

  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const onDelete = useCallback(async () => {
    setIsDeletingRows(true)
    const chunks = chunk(rowsSelected, CHUNK_SIZE)
    for (const chunk of chunks) {
      await deleteRows(chunk)
      setNumDeletedRows((prev) => prev + chunk.length)
      removeRows(chunk)
    }
    setTimeout(() => {
      setIsDialogOpen(false)
    }, 1000)
  }, [deleteRows, removeRows, rowsSelected])

  const onOpen = useCallback(() => {
    setIsDeletingRows(false)
    setNumDeletedRows(0)
    setNumRowsToDelete(rowsSelected.length)
    setIsDialogOpen(true)
  }, [rowsSelected.length])

  if (isViewMode) {
    return null
  }

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
        onClick={onOpen}
      >
        Delete
      </Button>
      {/* lazy load the dialog */}
      {isDialogOpen && (
        <AlertDialog
          motionPreset="none"
          isOpen={true}
          leastDestructiveRef={cancelRef}
          trapFocus={false}
          closeOnOverlayClick={!isDeletingRows}
          onClose={() => setIsDialogOpen(false)}
        >
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader fontSize="lg" fontWeight="bold">
                Delete rows
              </AlertDialogHeader>

              <AlertDialogBody>
                {isDeletingRows ? (
                  <>
                    <Text>
                      Deleting rows ({numDeletedRows} / {numRowsToDelete})
                    </Text>
                    <Progress
                      value={numDeletedRows}
                      max={numRowsToDelete}
                      mt={4}
                    />
                  </>
                ) : (
                  <Text>
                    Are you sure you want to <b>{numRowsToDelete}</b> row
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
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  colorScheme="red"
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
      )}
    </div>
  )
}

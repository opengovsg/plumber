import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

export type AlertDialogType = 'delete' | 'duplicate'
export type AlertHeaderType = 'Connection' | 'Pipe' | 'Tile'

interface MenuAlertDialogProps {
  isDialogOpen: boolean
  cancelRef: React.RefObject<HTMLButtonElement>
  onDialogClose: () => void
  dialogType: AlertDialogType
  dialogHeader: AlertHeaderType
  onClick: () => void
  isLoading: boolean
}

interface AlertDialogContent {
  header: string
  body: string
  buttonText: string
}

function getAlertDialogContent(
  dialogHeader: AlertHeaderType,
  dialogType: AlertDialogType,
): AlertDialogContent {
  switch (dialogType) {
    case 'delete':
      return {
        header: `Delete ${dialogHeader}`,
        body: `Are you sure you want to delete this ${dialogHeader?.toLowerCase()}? You can't undo this action afterwards.`,
        buttonText: 'Delete',
      }
    case 'duplicate':
      return {
        header: 'Duplicate Pipe',
        body: `You'll need to replace the data in every step and test each step in your duplicated pipe before publishing it.`,
        buttonText: 'Duplicate',
      }
  }
}

export default function MenuAlertDialog(props: MenuAlertDialogProps) {
  const {
    isDialogOpen,
    cancelRef,
    onDialogClose,
    dialogHeader,
    dialogType,
    onClick,
    isLoading,
  } = props
  const { header, body, buttonText } = getAlertDialogContent(
    dialogHeader,
    dialogType,
  )

  return (
    <AlertDialog
      isOpen={isDialogOpen}
      leastDestructiveRef={cancelRef}
      onClose={onDialogClose}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>{header}</AlertDialogHeader>

          <AlertDialogBody>{body}</AlertDialogBody>

          <AlertDialogFooter>
            <Button
              variant="clear"
              colorScheme="secondary"
              ref={cancelRef}
              onClick={onDialogClose}
            >
              Cancel
            </Button>
            <Button
              colorScheme="critical"
              onClick={onClick}
              ml={3}
              isLoading={isLoading}
            >
              {buttonText}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}

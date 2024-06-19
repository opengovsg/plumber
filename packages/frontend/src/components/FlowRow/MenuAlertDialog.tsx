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

interface MenuAlertDialogProps {
  isDialogOpen: boolean
  cancelRef: React.RefObject<HTMLButtonElement>
  onDialogClose: () => void
  type: AlertDialogType
  onClick: () => void
  isLoading: boolean
}

interface AlertDialogContent {
  header: string
  body: string
  buttonText: string
}

function getAlertDialogContent(type: AlertDialogType): AlertDialogContent {
  switch (type) {
    case 'delete':
      return {
        header: 'Delete Pipe',
        body: "Are you sure you want to delete this pipe? You can't undo this action afterwards.",
        buttonText: 'Delete',
      }
    case 'duplicate':
      return {
        header: 'Duplicate Pipe',
        body: `You'll need to test all your steps before publishing.`,
        buttonText: 'Duplicate',
      }
  }
}

export default function MenuAlertDialog(props: MenuAlertDialogProps) {
  const { isDialogOpen, cancelRef, onDialogClose, type, onClick, isLoading } =
    props
  const { header, body, buttonText } = getAlertDialogContent(type)

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

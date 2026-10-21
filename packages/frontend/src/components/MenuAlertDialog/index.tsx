import { type MouseEventHandler } from 'react'
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import MarkdownRenderer from '../MarkdownRenderer'

export type AlertDialogType =
  | 'delete'
  | 'duplicate'
  | 'duplicate-branch'
  | 'share-connections'
  | 'leave'
  | 'edit-connection'

export type AlertHeaderType =
  | 'Connection'
  | 'Pipe'
  | 'Tile'
  | 'Step'
  | 'File'
  | 'Branch'
  | 'Share connections'

interface MenuAlertDialogProps {
  isDialogOpen: boolean
  cancelRef: React.RefObject<HTMLButtonElement>
  onDialogClose: () => void
  dialogType: AlertDialogType
  dialogHeader: AlertHeaderType | string
  onClick: (() => void) | MouseEventHandler
  isLoading: boolean
  customBody?: string
}

interface AlertDialogContent {
  header: string
  body: string
  buttonText: string
  buttonColorScheme: 'critical' | 'primary'
  customBody?: string
}

function getAlertDialogContent(
  dialogHeader: AlertHeaderType | string,
  dialogType: AlertDialogType,
  customBody?: string,
): AlertDialogContent {
  switch (dialogType) {
    case 'delete':
      return {
        header: `Delete ${dialogHeader}`,
        body:
          customBody ??
          `Are you sure you want to delete this ${dialogHeader?.toLowerCase()}? You can't undo this action afterwards.`,
        buttonText: 'Delete',
        buttonColorScheme: 'critical',
      }
    case 'duplicate':
      return {
        header: 'Duplicate Pipe',
        body:
          customBody ??
          `You'll need to replace the data in every step and test each step in your duplicated pipe before publishing it.`,
        buttonText: 'Duplicate',
        buttonColorScheme: 'critical',
      }
    case 'duplicate-branch':
      return {
        header: `Duplicate ${dialogHeader}`,
        body: `Every step in this ${dialogHeader} will be duplicated. You will need to check each step again.`,
        buttonText: 'Duplicate',
        buttonColorScheme: 'critical',
      }
    case 'share-connections':
      return {
        header: 'Access to your connections',
        body:
          customBody ??
          `The collaborator will have access to your connections.`,
        buttonText: 'Yes, add editor',
        buttonColorScheme: 'critical',
      }
    case 'leave':
      return {
        header: 'Leave pipe',
        body:
          customBody ??
          'Are you sure you want to leave this pipe? You will lose access.',
        buttonText: 'Leave',
        buttonColorScheme: 'critical',
      }
    case 'edit-connection':
      return {
        header: 'Edit connection',
        body:
          customBody ??
          'Editing replaces the stored credentials. You cannot recover the old key, token, or password afterwards. A wrong value can break pipes that use this connection.',
        buttonText: 'Continue',
        buttonColorScheme: 'primary',
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
    customBody,
  } = props
  const { header, body, buttonText, buttonColorScheme } = getAlertDialogContent(
    dialogHeader,
    dialogType,
    customBody,
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

          <AlertDialogBody>
            <MarkdownRenderer source={body} />
          </AlertDialogBody>

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
              colorScheme={buttonColorScheme}
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

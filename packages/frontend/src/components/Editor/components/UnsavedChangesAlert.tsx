import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  useToast,
} from '@chakra-ui/react'
import { useContext, useState } from 'react'

import { EditorContext } from '@/contexts/Editor'

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
  const toast = useToast()
  const { saveDirtyStepRef, readOnly } = useContext(EditorContext)
  const [isSaving, setIsSaving] = useState(false)
  const canSave = !readOnly && saveDirtyStepRef.current !== null

  const handleLeave = () => {
    onLeave?.()
    onClose()
  }

  const handleSaveAndLeave = async () => {
    try {
      setIsSaving(true)
      await saveDirtyStepRef.current?.()
    } catch {
      toast({
        status: 'error',
        title: 'Could not save your changes. Please try again.',
      })
      return
    } finally {
      setIsSaving(false)
    }
    handleLeave()
  }

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>Save before you leave?</AlertDialogHeader>

          <AlertDialogCloseButton isDisabled={isSaving} />

          <AlertDialogBody>
            You haven&apos;t saved your changes to this step. Save now to keep
            them, or keep editing.
          </AlertDialogBody>

          <AlertDialogFooter gap={3}>
            <Button
              ref={cancelRef}
              variant={canSave ? 'clear' : 'solid'}
              colorScheme={canSave ? 'secondary' : undefined}
              onClick={onClose}
              isDisabled={isSaving}
            >
              Keep editing
            </Button>
            {canSave && (
              <Button onClick={handleSaveAndLeave} isLoading={isSaving}>
                Save and continue
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  )
}

import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  useToast,
} from '@chakra-ui/react'
import type { IStep } from '@plumber/types'
import { useContext, useState } from 'react'

import { EditorContext } from '@/contexts/Editor'

export interface UnsavedChangesAlertProps {
  cancelRef: React.RefObject<HTMLButtonElement>
  isOpen: boolean
  onClose: () => void
  /** Receives the saved step when the user chose Save and continue. */
  onLeave?: (savedStep?: IStep) => void
  /** Keeps the user editing if the saved step is incomplete, e.g. before publishing. */
  requiresCompleteStep?: boolean
}

export default function UnsavedChangesAlert({
  cancelRef,
  isOpen,
  onClose,
  onLeave,
  requiresCompleteStep = false,
}: UnsavedChangesAlertProps): React.ReactElement {
  const toast = useToast()
  const { saveDirtyStepRef, readOnly } = useContext(EditorContext)
  const [isSaving, setIsSaving] = useState(false)
  const canSave = !readOnly && saveDirtyStepRef.current !== null

  const handleLeave = (savedStep?: IStep) => {
    onLeave?.(savedStep)
    onClose()
  }

  const handleSaveAndLeave = async () => {
    let savedStep: IStep | undefined
    try {
      setIsSaving(true)
      savedStep = await saveDirtyStepRef.current?.()
    } catch {
      toast({
        status: 'error',
        title: 'Could not save your changes. Please try again.',
      })
      return
    } finally {
      setIsSaving(false)
    }
    if (requiresCompleteStep && savedStep?.status === 'incomplete') {
      toast({
        status: 'warning',
        title: 'Your changes are saved. Complete this step before you publish.',
      })
      onClose()
      return
    }
    handleLeave(savedStep)
  }

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
      // IMPORTANT: the pending save still runs the continuation, so a
      // dismissal here would navigate away from resumed editing.
      closeOnEsc={!isSaving}
      closeOnOverlayClick={!isSaving}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>Save before you leave?</AlertDialogHeader>

          <AlertDialogBody>
            You haven&apos;t saved this step yet. Save before you leave, or keep
            editing.
          </AlertDialogBody>

          <AlertDialogFooter gap={3}>
            <Button
              mr="auto"
              variant="link"
              color="base.content.medium"
              _hover={{
                color: 'base.content.default',
                textDecoration: 'underline',
              }}
              onClick={() => handleLeave()}
              isDisabled={isSaving}
            >
              Discard changes
            </Button>
            <Button
              ref={cancelRef}
              variant="clear"
              colorScheme="secondary"
              color="base.content.strong"
              bg="interaction.muted.neutral.active"
              _hover={{ bg: 'interaction.tinted.neutral.hover' }}
              _active={{ bg: 'interaction.tinted.neutral.active' }}
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

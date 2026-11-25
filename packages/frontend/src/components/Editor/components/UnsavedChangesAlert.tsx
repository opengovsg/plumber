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
import { usePostHog } from 'posthog-js/react'
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
  const posthog = usePostHog()
  const { saveDirtyStepRef, readOnly, flow } = useContext(EditorContext)
  const [isSaving, setIsSaving] = useState(false)
  const canSave = !readOnly && saveDirtyStepRef.current !== null

  const captureResolved = (
    choice: 'save_and_continue' | 'discard' | 'keep_editing',
    outcome?: 'saved' | 'blocked_incomplete' | 'save_failed',
  ) => {
    posthog.capture('flow_editor:unsaved_changes_resolved', {
      choice,
      outcome,
      is_publish: requiresCompleteStep,
      flow_id: flow?.id,
    })
  }

  const handleKeepEditing = () => {
    captureResolved('keep_editing')
    onClose()
  }

  const handleDiscard = () => {
    captureResolved('discard')
    handleLeave()
  }

  const handleLeave = (savedStep?: IStep) => {
    onLeave?.(savedStep)
    onClose()
  }

  const handleSaveAndLeave = async () => {
    let savedStep: IStep | undefined
    try {
      setIsSaving(true)
      savedStep = await saveDirtyStepRef.current?.()
    } catch (error) {
      captureResolved('save_and_continue', 'save_failed')
      posthog.captureException(error)
      toast({
        status: 'error',
        title: 'Could not save your changes. Please try again.',
      })
      return
    } finally {
      setIsSaving(false)
    }
    if (requiresCompleteStep && savedStep?.status === 'incomplete') {
      captureResolved('save_and_continue', 'blocked_incomplete')
      toast({
        status: 'warning',
        title: 'Your changes are saved. Complete this step before you publish.',
      })
      onClose()
      return
    }
    captureResolved('save_and_continue', 'saved')
    handleLeave(savedStep)
  }

  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={handleKeepEditing}
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
              onClick={handleDiscard}
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
              onClick={handleKeepEditing}
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

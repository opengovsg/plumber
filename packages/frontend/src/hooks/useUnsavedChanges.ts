import { useContext, useRef } from 'react'
import { useDisclosure } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'

interface UseUnsavedChangesProps {
  onProceed: () => void
}

interface UseUnsavedChangesReturn {
  cancelRef: React.RefObject<HTMLButtonElement>
  isWarningOpen: boolean
  onWarningOpen: () => void
  onWarningClose: () => void
  handleProceed: () => void
  handleLeave: () => void
}

export function useUnsavedChanges({
  onProceed,
}: UseUnsavedChangesProps): UseUnsavedChangesReturn {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const {
    isOpen: isWarningOpen,
    onOpen: onWarningOpen,
    onClose: onWarningClose,
  } = useDisclosure()

  const { shouldWarnOnLeave, resetForm, setShouldWarnOnLeave } =
    useContext(EditorContext)

  const handleProceed = () => {
    if (shouldWarnOnLeave) {
      onWarningOpen()
    } else {
      onProceed()
    }
  }

  const handleLeave = () => {
    onProceed()
    resetForm()
    setShouldWarnOnLeave(false)
  }

  return {
    cancelRef,
    isWarningOpen,
    onWarningOpen,
    onWarningClose,
    handleProceed,
    handleLeave,
  }
}

import { IStep } from '@plumber/types'

import { useContext, useRef } from 'react'
import { CloseButton, Flex, Text, useDisclosure } from '@chakra-ui/react'

import EditableInput from '@/components/EditableInput'
import { EditorContext } from '@/contexts/Editor'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import UnsavedChangesAlert from '../Editor/UnsavedChangesAlert'

interface StepHeaderProps {
  step: IStep
}

export default function StepHeader(props: StepHeaderProps) {
  const { step } = props
  const cancelRef = useRef(null)
  const {
    isOpen: isWarningOpen,
    onOpen: onWarningOpen,
    onClose: onWarningClose,
  } = useDisclosure()

  const {
    allApps,
    readOnly: isReadOnlyEditor,
    shouldWarnOnLeave,
    onDrawerClose,
    onUpdateStep,
    setCurrentStepId,
    setShouldWarnOnLeave,
  } = useContext(EditorContext)

  const { position, stepName: initialStepName } = useStepMetadata(allApps, step)

  const handleClose = () => {
    if (shouldWarnOnLeave) {
      onWarningOpen()
    } else {
      handleLeave()
    }
  }

  const handleLeave = () => {
    onDrawerClose()
    setCurrentStepId(null)
    setShouldWarnOnLeave(false)
  }

  const onSave = async (value: string) => {
    await onUpdateStep({
      ...step,
      config: {
        ...step.config,
        stepName: value,
      },
    })
  }

  if (!step) {
    return null
  }

  return (
    <Flex
      alignItems="center"
      justifyContent="space-between"
      position="fixed"
      w="full"
      px="4"
      height="2rem"
    >
      <Flex alignItems="center" maxW="100%">
        {position && <Text whiteSpace="pre-wrap">{position}.&nbsp;</Text>}
        <EditableInput
          key={step.id}
          value={initialStepName}
          onSave={onSave}
          readOnly={isReadOnlyEditor}
        />
      </Flex>

      <CloseButton onClick={handleClose} position="absolute" right="4" />
      <UnsavedChangesAlert
        cancelRef={cancelRef}
        isOpen={isWarningOpen}
        onClose={onWarningClose}
        onLeave={handleLeave}
      />
    </Flex>
  )
}

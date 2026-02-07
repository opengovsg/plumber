import { IStep } from '@plumber/types'

import { useContext, useRef } from 'react'
import { CloseButton, Flex, Text, useDisclosure } from '@chakra-ui/react'

import EditableInput from '@/components/EditableInput'
import { EditorContext } from '@/contexts/Editor'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import UnsavedChangesAlert from '../Editor/components/UnsavedChangesAlert'

import { editorRightDrawerStyles as styles } from './styles'

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
    readOnly: isReadOnlyEditor,
    shouldWarnOnLeave,
    onDrawerClose,
    onUpdateStep,
    setCurrentStepId,
    setShouldWarnOnLeave,
  } = useContext(EditorContext)

  const { defaultStepName, displayPosition, stepName } = useStepMetadata(step)

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
    <Flex {...styles.stepHeader}>
      <Flex alignItems="center" maxW="100%">
        {displayPosition && (
          <Text whiteSpace="pre-wrap">{displayPosition}.&nbsp;</Text>
        )}
        <EditableInput
          key={step.id}
          value={stepName}
          onSave={onSave}
          readOnly={isReadOnlyEditor}
          placeholder={defaultStepName}
          allowEmpty={true}
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

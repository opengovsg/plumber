import { useMutation } from '@apollo/client'
import { CloseButton, Flex, Text, useDisclosure } from '@chakra-ui/react'
import { IStep } from '@plumber/types'
import { useContext, useRef } from 'react'

import EditableInput from '@/components/EditableInput'
import { EditorContext } from '@/contexts/Editor'
import { RENAME_STEP } from '@/graphql/mutations/rename-step'
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
    flow,
    hasEditPermission,
    hasFlowTransfer,
    shouldWarnOnLeave,
    onDrawerClose,
    setCurrentStepId,
    setShouldWarnOnLeave,
  } = useContext(EditorContext)
  const { defaultStepName, displayPosition, stepName, isMrfStep } =
    useStepMetadata(step)

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

  // A dedicated mutation, because updateStep rejects every edit on a published pipe.
  const [renameStep] = useMutation(RENAME_STEP)
  const onSave = async (value: string) => {
    await renameStep({
      variables: {
        input: {
          id: step.id,
          flow: { id: flow.id, updatedAt: flow.updatedAt },
          stepName: value,
        },
      },
    })
  }

  if (!step) {
    return null
  }

  return (
    <Flex {...styles.stepHeader}>
      <Flex
        alignItems="center"
        maxW="100%"
        fontSize="18px"
        fontWeight={500}
        color="base.content.strong"
      >
        {displayPosition && (
          <Text whiteSpace="pre-wrap">{displayPosition}.&nbsp;</Text>
        )}
        <EditableInput
          key={step.id}
          value={stepName}
          onSave={onSave}
          // Renaming is allowed on published pipes, but not during a pending transfer.
          readOnly={!hasEditPermission || hasFlowTransfer || isMrfStep}
          placeholder={defaultStepName}
          allowEmpty={true}
          fontWeight={500}
          fontSize="18px"
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

import { IStep } from '@plumber/types'

import { useContext } from 'react'
import { CloseButton, Flex } from '@chakra-ui/react'

import EditableInput from '@/components/EditableInput'
import { EditorContext } from '@/contexts/Editor'
import { useStepMetadata } from '@/hooks/useStepMetadata'

interface StepHeaderProps {
  step: IStep
}

export default function StepHeader(props: StepHeaderProps) {
  const { step } = props

  const {
    allApps,
    readOnly: isReadOnlyEditor,
    onDrawerClose,
    onUpdateStep,
    setCurrentStepId,
  } = useContext(EditorContext)

  const { caption: initialStepName } = useStepMetadata(allApps, step)

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
      <EditableInput
        value={initialStepName}
        onSave={onSave}
        readOnly={isReadOnlyEditor}
      />

      <CloseButton
        onClick={() => {
          onDrawerClose()
          setCurrentStepId(null)
        }}
        position="absolute"
        right="4"
      />
    </Flex>
  )
}

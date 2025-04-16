import { IFlow } from '@plumber/types'

import { useContext, useMemo } from 'react'
import { Flex } from '@chakra-ui/react'

import { EDITOR_MAX_HEIGHT } from '@/components/Editor/constants'
import { EditorContext } from '@/contexts/Editor'

import Step from './Step'
import StepHeader from './StepHeader'

interface EditorRightDrawerProps {
  flow: IFlow
  flowStepGroupIconUrl?: string
  index: number | null
  isLastStep: boolean
  steps: any[]
}

export default function EditorRightDrawer(props: EditorRightDrawerProps) {
  const { flow, index, isLastStep, steps } = props

  const {
    currentStepId,
    currentStepIndex,
    isDrawerOpen,
    isMobile,
    onDrawerClose,
    onDrawerOpen,
    setCurrentStepId,
    setCurrentStepIndex,
  } = useContext(EditorContext)

  const step = useMemo(() => {
    return steps.find((step) => step.id === currentStepId)
  }, [currentStepId, steps])

  if (!currentStepId || !step) {
    return null
  }

  return (
    <Flex
      flexDir="column"
      position="relative"
      width={isDrawerOpen ? (isMobile ? '100vw' : '55%') : '0'}
      bg="white"
      py="4"
      borderRadius="lg"
      boxShadow="lg"
      transition="width 0.3s ease-in-out, transform 0.3s ease-in-out"
      display={isDrawerOpen ? 'block' : 'none'}
      transform={isDrawerOpen ? 'translateX(0)' : 'translateX(100%)'}
      maxHeight={EDITOR_MAX_HEIGHT}
      overflowY="auto"
    >
      <StepHeader step={step} />
      <Flex
        height="calc(100% - 1.5rem)"
        overflowY="auto"
        position="relative"
        px="4"
        top="2.5rem"
      >
        <Step
          index={index}
          step={step}
          isLastStep={index === steps.length - 1}
          onContinue={() => {
            if (!isLastStep && currentStepIndex !== null) {
              const nextStepIndex = currentStepIndex + 1
              const nextStepId = steps[nextStepIndex]?.id
              setCurrentStepId(nextStepId)
              setCurrentStepIndex(nextStepIndex)
            } else if (isLastStep) {
              onDrawerClose()
            }
          }}
          onOpen={onDrawerOpen}
          onClose={onDrawerClose}
          templateConfig={flow?.config?.templateConfig}
        />
      </Flex>
    </Flex>
  )
}

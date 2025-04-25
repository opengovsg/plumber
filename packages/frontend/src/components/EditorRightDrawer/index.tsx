import { IFlow, IStep } from '@plumber/types'

import { useContext, useMemo } from 'react'
import { Box, CloseButton, Flex } from '@chakra-ui/react'

import { EDITOR_MAX_HEIGHT } from '@/components/Editor/constants'
import { EditorContext } from '@/contexts/Editor'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import Step from './Step'
import StepGroup from './StepGroup'

interface EditorRightDrawerProps {
  flow: IFlow
  flowStepGroupIconUrl?: string
  index: number | null
  isLastStep: boolean
  isNested?: boolean
  onStepChange: (step: IStep) => void
  groupedSteps: IStep[]
  steps: any[]
}

export default function EditorRightDrawer(props: EditorRightDrawerProps) {
  const {
    flow,
    flowStepGroupIconUrl,
    index,
    isLastStep,
    isNested,
    onStepChange,
    groupedSteps,
    steps,
  } = props

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

  const { caption, isIfThenStep } = useStepMetadata(step)

  const showStep = useMemo(
    () => !isIfThenStep || (isIfThenStep && isNested),
    [isIfThenStep, isNested],
  )

  if (!currentStepId || !step) {
    return null
  }

  return (
    <Flex
      flexDir="column"
      position="relative"
      width={
        isDrawerOpen ? (isMobile ? '100vw' : isNested ? '55%' : '55%') : '0'
      }
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
      <Flex
        alignItems="center"
        justifyContent="space-between"
        position="fixed"
        w="full"
        px="4"
      >
        <Box>{caption}</Box>
        <CloseButton
          onClick={() => {
            setCurrentStepId(null)
            onDrawerClose()
          }}
          position="absolute"
          right="4"
        />
      </Flex>
      <Flex
        height="calc(100% - 1.5rem)"
        overflowY="auto"
        position="relative"
        px="4"
        top="2rem"
      >
        {showStep && (
          <Step
            index={index}
            step={step}
            isLastStep={index === steps.length - 1}
            collapsed={true}
            onChange={onStepChange}
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
            onClose={onDrawerClose}
            onOpen={onDrawerOpen}
            templateConfig={flow?.config?.templateConfig}
          />
        )}
        {groupedSteps.length > 0 && isIfThenStep && (
          <StepGroup
            iconUrl={flowStepGroupIconUrl}
            flow={flow}
            steps={groupedSteps}
            collapsed={currentStepId !== groupedSteps[0].id}
            onOpen={() => setCurrentStepId(groupedSteps[0].id)}
            onClose={() => {
              setCurrentStepId(null)
              onDrawerClose()
            }}
          />
        )}
      </Flex>
    </Flex>
  )
}

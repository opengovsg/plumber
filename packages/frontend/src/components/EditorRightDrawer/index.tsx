import { IFlow, IStep } from '@plumber/types'

import { useMemo } from 'react'
import { Box, CloseButton, Flex } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'

import { EDITOR_MAX_HEIGHT } from '@/components/Editor/constants'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import Step from './Step'
import StepGroup from './StepGroup'

interface EditorRightDrawerProps {
  flow: IFlow
  flowStepGroupIconUrl?: string
  index: number | null
  isDrawerOpen: boolean
  isLastStep: boolean
  isNested?: boolean
  onDrawerClose: () => void
  onDrawerOpen: () => void
  onStepChange: (step: IStep) => void
  currentStepId: string | null
  currentStepIndex: number | null
  groupedSteps: IStep[]
  setCurrentStepId: (stepId: string | null) => void
  setCurrentStepIndex: (stepIndex: number) => void
  steps: any[]
}

export default function EditorRightDrawer(props: EditorRightDrawerProps) {
  const {
    flow,
    flowStepGroupIconUrl,
    index,
    isDrawerOpen,
    isLastStep,
    isNested,
    onDrawerClose,
    onDrawerOpen,
    onStepChange,
    currentStepId,
    currentStepIndex,
    groupedSteps,
    setCurrentStepId,
    setCurrentStepIndex,
    steps,
  } = props

  const isMobile = useIsMobile()

  const step = useMemo(() => {
    return steps.find((step) => step.id === currentStepId)
  }, [currentStepId, steps])

  const { caption } = useStepMetadata(step)

  const isIfThenStep = useMemo(() => {
    return step?.appKey === 'toolbox' && step?.key === 'ifThen'
  }, [step])

  const showStep = useMemo(
    () => !isIfThenStep || (isIfThenStep && isNested),
    [isIfThenStep, isNested],
  )

  if (!currentStepId || !step) {
    return null
  }

  const getStepWidth = () => {
    if (isDrawerOpen) {
      if (isMobile) {
        return '100vw'
      }
      if (isNested) {
        return '40rem'
      }
      return '53.25rem'
    }

    return '0'
  }

  return (
    <Flex
      flexDir="column"
      position="relative"
      width={getStepWidth()}
      bg="white"
      p="4"
      borderRadius="lg"
      boxShadow="lg"
      transition="width 0.3s ease-in-out, transform 0.3s ease-in-out"
      display={isDrawerOpen ? 'block' : 'none'}
      transform={isDrawerOpen ? 'translateX(0)' : 'translateX(100%)'}
      // FIXME (kevinkim-ogp): this is a temporary fix for the scrollbar
      // find a better way to get the max height
      maxHeight={EDITOR_MAX_HEIGHT}
      overflowY="auto"
    >
      <Flex alignItems="center" justifyContent="space-between" mb={4}>
        <Box>{caption}</Box>
        <CloseButton onClick={onDrawerClose} position="absolute" right="4" />
      </Flex>

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
          onClose={() => setCurrentStepId(null)}
          setCurrentStepId={setCurrentStepId}
        />
      )}
    </Flex>
  )
}

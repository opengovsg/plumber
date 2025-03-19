import { IFlow, IStep } from '@plumber/types'

import { useMemo } from 'react'
import { Box, CloseButton, Flex } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'

import { useStepMetadata } from '@/hooks/useStepMetadata'

import { EDITOR_MAX_HEIGHT } from '../Editor'

import Step from './Step'
import StepGroup from './StepGroup'

interface EditorRightDrawerProps {
  flow: IFlow
  flowStepGroupIconUrl?: string
  index: number | null
  isDrawerOpen: boolean
  isLastStep: boolean
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
// FIXME (kevinkim-ogp): accordions are not opening correctly on test step
export default function EditorRightDrawer(props: EditorRightDrawerProps) {
  const {
    flow,
    flowStepGroupIconUrl,
    index,
    isDrawerOpen,
    isLastStep,
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

  if (!currentStepId || !step) {
    return null
  }

  return (
    <Flex
      flexDir="column"
      position="relative"
      width={isDrawerOpen ? (isMobile ? '100vw' : '53.25rem') : '0'}
      bg="white"
      p="4"
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
        <CloseButton
          onClick={onDrawerClose}
          position="absolute"
          top="0"
          right="4"
        />
      </Flex>

      {!isIfThenStep && (
        <Step
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

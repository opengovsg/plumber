import { IStep } from '@plumber/types'

import { useContext, useMemo } from 'react'
import { Flex } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'

import Step from './Step'
import StepHeader from './StepHeader'

interface EditorRightDrawerProps {
  flowStepGroupIconUrl?: string
  index: number | null
  steps: IStep[]
}

export default function EditorRightDrawer(props: EditorRightDrawerProps) {
  const { index, steps } = props

  const { currentStepId } = useContext(EditorContext)

  const step = useMemo(() => {
    return steps.find((step) => step.id === currentStepId)
  }, [currentStepId, steps])

  if (!currentStepId || !step) {
    return null
  }

  return (
    <Flex flexDir="column" w="100%" py="4" overflowY="auto" h="100%">
      <StepHeader step={step} />
      <Flex
        height="calc(100% - 1.5rem)"
        overflowY="auto"
        overflowX="hidden"
        position="relative"
        px="4"
        top="2.5rem"
      >
        <Step step={step} isLastStep={index === steps.length - 1} />
      </Flex>
    </Flex>
  )
}

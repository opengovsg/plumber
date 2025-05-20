import { IStep } from '@plumber/types'

import { useContext, useMemo } from 'react'
import { Flex } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
import { useStepMetadata } from '@/hooks/useStepMetadata'

import Step from './Step'
import StepHeader from './StepHeader'
import { editorRightDrawerStyles as styles } from './styles'

interface EditorRightDrawerProps {
  flowStepGroupIconUrl?: string
  index: number | null
  steps: IStep[]
}

export default function EditorRightDrawer(props: EditorRightDrawerProps) {
  const { index, steps } = props

  const { allApps, currentStepId } = useContext(EditorContext)

  const step = useMemo(() => {
    return steps.find((step) => step.id === currentStepId)
  }, [currentStepId, steps])
  const { hasConnection } = useStepMetadata(allApps, step)

  if (!currentStepId || !step) {
    return null
  }

  return (
    <Flex flexDir="column" w="100%" py="4" overflowY="auto" h="100%">
      <StepHeader step={step} />
      <Flex {...styles.stepContentsWrapper} pt={hasConnection ? 0 : 4}>
        <Step step={step} isLastStep={index === steps.length - 1} />
      </Flex>
    </Flex>
  )
}

import { IStep } from '@plumber/types'

import { Flex } from '@chakra-ui/react'

import { useStepMetadata } from '@/hooks/useStepMetadata'

import Step from './Step'
import StepHeader from './StepHeader'
import { editorRightDrawerStyles as styles } from './styles'

interface EditorRightDrawerProps {
  step?: IStep
}

export default function EditorRightDrawer(props: EditorRightDrawerProps) {
  const { step } = props

  const { hasConnection } = useStepMetadata(step)

  if (!step) {
    return null
  }

  return (
    <Flex
      data-test="editor-right-drawer"
      flexDir="column"
      w="100%"
      py="4"
      overflowY="auto"
      h="100%"
    >
      <StepHeader step={step} />
      <Flex {...styles.stepContentsWrapper} pt={hasConnection ? 0 : 4}>
        <Step step={step} />
      </Flex>
    </Flex>
  )
}

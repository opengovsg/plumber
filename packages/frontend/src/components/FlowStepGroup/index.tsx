import { Flex } from '@chakra-ui/react'
import { IStep } from '@plumber/types'
import { useContext } from 'react'

import { EditorContext } from '@/contexts/Editor'
import { getFlowStepHeaderWidth } from '@/helpers/editor'

import { MIN_FLOW_STEP_WIDTH } from '../Editor/constants'
import ForEach from './Content/ForEach'

interface FlowStepGroupProps {
  steps: IStep[]
}

export default function FlowStepGroup(props: FlowStepGroupProps) {
  const { steps } = props
  const { isDrawerOpen, isMobile } = useContext(EditorContext)

  return (
    <Flex
      w="100%"
      alignItems="center"
      justifyContent={isDrawerOpen ? 'flex-start' : 'center'}
    >
      <Flex
        display={isMobile ? 'block' : 'flex'}
        w={getFlowStepHeaderWidth(isDrawerOpen, isMobile)}
        minW={MIN_FLOW_STEP_WIDTH}
      >
        <ForEach steps={steps} />
      </Flex>
    </Flex>
  )
}

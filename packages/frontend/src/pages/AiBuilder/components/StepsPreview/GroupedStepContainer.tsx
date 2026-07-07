import { Flex } from '@chakra-ui/react'
import { useIsMobile } from '@opengovsg/design-system-react'

import { MIN_FLOW_STEP_WIDTH } from '@/components/Editor/constants'
import { flowStepGroupStyles } from '@/components/FlowStepGroup/styles'

import GroupedStepHeader from './GroupedStepHeader'

interface GroupedStepContainerProps {
  children: React.ReactNode
  isNested: boolean
  stepGroupType: string
  stepGroupCaption: string
  isPending?: boolean
}

export default function GroupedStepContainer(props: GroupedStepContainerProps) {
  const { children, isNested, stepGroupType, stepGroupCaption, isPending } =
    props
  const isMobile = useIsMobile()
  return (
    <Flex
      justifyContent="center"
      w="100%"
      opacity={isPending ? 0.55 : 1}
      transition="opacity 0.15s"
      pointerEvents={isPending ? 'none' : 'auto'}
    >
      <Flex
        {...flowStepGroupStyles.container}
        display={isMobile ? 'block' : 'flex'}
        w="100%"
        minW={MIN_FLOW_STEP_WIDTH}
        pb={4}
        maxW="600px"
      >
        <GroupedStepHeader
          stepGroupType={stepGroupType}
          stepGroupCaption={stepGroupCaption}
          isNested={isNested}
        />
        {children}
      </Flex>
    </Flex>
  )
}

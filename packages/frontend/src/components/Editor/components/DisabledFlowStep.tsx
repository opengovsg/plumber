import { Flex } from '@chakra-ui/react'
import { TouchableTooltip } from '@opengovsg/design-system-react'
import { IStep } from '@plumber/types'
import { useContext } from 'react'

import StepAppIcon from '@/components/FlowStep/components/StepAppIcon'
import StepNameAndDemo from '@/components/FlowStep/components/StepNameAndDemo'
import { flowStepStyles } from '@/components/FlowStep/styles'
import { EditorContext } from '@/contexts/Editor'
import { getFlowStepHeaderWidth } from '@/helpers/editor'
import { useStepMetadata } from '@/hooks/useStepMetadata'

interface DisabledFlowStepProps {
  step: IStep
  tooltipText: string
}

export function DisabledFlowStep(props: DisabledFlowStepProps) {
  const { step, tooltipText } = props

  const { isMobile, isDrawerOpen } = useContext(EditorContext)

  const { app, stepName } = useStepMetadata(step)
  const headerWidth = getFlowStepHeaderWidth(isDrawerOpen, isMobile, false)

  return (
    <Flex
      flexDir="row"
      alignItems="center"
      width="100%"
      display={isMobile ? 'block' : 'flex'}
      my={4}
    >
      <TouchableTooltip label={tooltipText} wrapperStyles={{ width: '100%' }}>
        <Flex
          data-test="flow-step"
          {...flowStepStyles.container}
          h="64px"
          w={headerWidth}
        >
          <Flex
            {...flowStepStyles.topHeader}
            opacity={0.4}
            pointerEvents="none"
          >
            <StepAppIcon app={app} step={step} />
            <StepNameAndDemo stepName={stepName} />
          </Flex>
        </Flex>
      </TouchableTooltip>
    </Flex>
  )
}

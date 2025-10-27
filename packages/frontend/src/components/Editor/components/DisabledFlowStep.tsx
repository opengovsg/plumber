import { IStep } from '@plumber/types'

import { useContext } from 'react'
import { Flex } from '@chakra-ui/react'
import { TouchableTooltip } from '@opengovsg/design-system-react'

import StepAppIcon from '@/components/FlowStep/components/StepAppIcon'
import StepCaptionAndDemo from '@/components/FlowStep/components/StepCaptionAndDemo'
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

  const { app, caption } = useStepMetadata(step)
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
            <StepCaptionAndDemo app={app} caption={caption} />
          </Flex>
        </Flex>
      </TouchableTooltip>
    </Flex>
  )
}

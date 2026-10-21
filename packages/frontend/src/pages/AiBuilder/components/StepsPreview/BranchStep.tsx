import { IStep } from '@plumber/types'

import { Box, Flex, Text } from '@chakra-ui/react'

import { branchStyles } from '@/components/FlowStepGroup/Content/IfThen/styles'
import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'
import { useStepConfigContext } from '@/pages/AiBuilder/StepConfigContext'

import Step from './Step'

interface BranchStepProps {
  branchSteps: IStep[]
  isMobile: boolean
  effectiveActiveStepId?: string | null
}

export default function BranchStep(props: BranchStepProps) {
  const { branchSteps, effectiveActiveStepId } = props
  const { output } = useAiBuilderContext()
  const { stepParametersByStepId, completedStepIds } = useStepConfigContext()

  const isMcpPipeMode = Boolean(output?.pipeId)
  const branchName = branchSteps[0].parameters?.branchName as string

  return (
    <Flex key={String(branchSteps[0].position)} {...branchStyles.container}>
      <Box w={'100%'} mb={2} h={6} overflow="hidden" role="group">
        <Text textStyle="subhead-1" color="base.content.default" noOfLines={1}>
          {branchName}
        </Text>
      </Box>
      <Box w="100%">
        {branchSteps.map((step, index) => (
          <Step
            key={String(step.position)}
            step={step}
            isNested={true}
            isLastStep={index === branchSteps.length - 1}
            {...(isMcpPipeMode && {
              isActive: step.id === effectiveActiveStepId,
              isConfigured: Boolean(step.id && completedStepIds.has(step.id)),
              parameters: step.id ? stepParametersByStepId[step.id] : undefined,
            })}
          />
        ))}
      </Box>
    </Flex>
  )
}

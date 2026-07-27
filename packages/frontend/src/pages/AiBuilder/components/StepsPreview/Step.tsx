import { IApp, IStep } from '@plumber/types'

import { BiInfoCircle } from 'react-icons/bi'
import { Box, Divider, Flex, Icon, Text } from '@chakra-ui/react'

import StepAppIcon from '@/components/FlowStep/components/StepAppIcon'
import StepNameAndDemo from '@/components/FlowStep/components/StepNameAndDemo'
import { flowStepStyles } from '@/components/FlowStep/styles'
import { SUPPORT_FORM_LINK } from '@/config/urls'
import getStepName from '@/helpers/getStepName'
import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'

interface AiStep extends IStep {
  description?: string
}

interface StepProps {
  step?: AiStep | null
  isNested?: boolean
  isLastStep?: boolean
}

export default function Step(props: StepProps) {
  const { step, isNested, isLastStep } = props
  const { allApps } = useAiBuilderContext()

  const app = allApps?.find(
    (currentApp: IApp) => currentApp.key === step?.appKey,
  )
  const { stepName } = getStepName(allApps, step as IStep)

  if (!step) {
    return (
      <Flex justifyContent="center" w="100%">
        <Flex
          h={isNested ? '48px' : '64px'}
          alignItems="center"
          bg="interaction.warning-subtle.default"
          borderColor="interaction.warning.default"
          borderRadius="lg"
          borderWidth="1px"
          gap={4}
          p={4}
          w={isNested ? '100%' : '600px'}
          _hover={{
            bg: 'interaction.warning-subtle.default',
            '& .hover-remove-button': {
              visibility: 'visible',
            },
          }}
        >
          <Icon
            as={BiInfoCircle}
            boxSize={6}
            color="interaction.warning.hover"
          />
          <Box py={isNested ? 2 : 4}>
            <Text textStyle="subhead-2">
              Something went wrong. Modify your prompt and try again.
            </Text>
            <Text textStyle="caption-1" mt={1}>
              If this issue persists, contact us at{' '}
              <a href={SUPPORT_FORM_LINK} target="_blank" rel="noreferrer">
                {SUPPORT_FORM_LINK}
              </a>
            </Text>
          </Box>
        </Flex>
      </Flex>
    )
  }

  return (
    <Flex flexDir="column" w="100%">
      <Flex justifyContent="center">
        <Flex
          data-test="flow-step"
          {...flowStepStyles.container}
          borderTopWidth="1px"
          borderTopRadius="lg"
          w={isNested ? '100%' : '600px'}
          pointerEvents="none"
        >
          <Flex {...flowStepStyles.topHeader} py={isNested ? 3 : 4}>
            <StepAppIcon
              isCompleted={step.status === 'completed'}
              isNested={isNested}
              isTestSuccessful={step.status === 'completed' ? true : undefined}
              shouldTestStepAgain={false}
              app={app}
              step={step}
            />
            <Box w="100%">
              <StepNameAndDemo
                stepName={stepName}
                displayPosition={step.position}
              />
              <Text textStyle="body-2">{step.description}</Text>
            </Box>
          </Flex>
        </Flex>
      </Flex>
      {!isLastStep && (
        <Flex justifyContent="center" h={isNested ? 6 : 12}>
          <Divider orientation="vertical" borderColor="base.divider.strong" />
        </Flex>
      )}
    </Flex>
  )
}

import { IApp, IJSONObject, IStep } from '@plumber/types'

import { useMemo, useState } from 'react'
import { BiInfoCircle } from 'react-icons/bi'
import { RiArrowDownSLine, RiArrowUpSLine } from 'react-icons/ri'
import { Box, Divider, Flex, Icon, Text } from '@chakra-ui/react'

import StepAppIcon from '@/components/FlowStep/components/StepAppIcon'
import StepNameAndDemo from '@/components/FlowStep/components/StepNameAndDemo'
import { flowStepStyles } from '@/components/FlowStep/styles'
import { SUPPORT_FORM_LINK } from '@/config/urls'
import getStepName from '@/helpers/getStepName'
import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'

import StepParameterRows from './StepParameterRows'

interface AiStep extends IStep {
  description?: string
  connectionLabel?: string | null
}

interface StepProps {
  step?: AiStep | null
  isNested?: boolean
  isLastStep?: boolean
  isActive?: boolean
  isConfigured?: boolean
  parameters?: IJSONObject
}

export default function Step(props: StepProps) {
  const { step, isNested, isLastStep, isActive, isConfigured, parameters } =
    props
  const { allApps, steps } = useAiBuilderContext()
  const [isExpanded, setIsExpanded] = useState(false)

  const app = allApps?.find(
    (currentApp: IApp) => currentApp.key === step?.appKey,
  )
  const { stepName } = getStepName(allApps, step as IStep)

  const stepNameById = useMemo(
    () =>
      new Map(
        steps.map((s) => [
          s.id,
          `${s.position}. ${getStepName(allApps, s).stepName}`,
        ]),
      ),
    [steps, allApps],
  )

  // Only mute when we're in configuration mode (props explicitly set to false)
  // Undefined means proposal mode — show all steps at full opacity
  const isPending = isActive === false && isConfigured === false
  const showParams = parameters && (isActive || (isConfigured && isExpanded))

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
    <Flex
      flexDir="column"
      w="100%"
      opacity={isPending ? 0.55 : 1}
      transition="opacity 0.15s"
    >
      <Flex justifyContent="center">
        <Flex
          data-test="flow-step"
          {...flowStepStyles.container}
          borderTopWidth="1px"
          borderTopRadius="lg"
          w={isNested ? '100%' : '600px'}
          pointerEvents={isPending ? 'none' : 'auto'}
          flexDir="column"
          alignItems="stretch"
          justifyContent="flex-start"
          cursor={isConfigured && !isActive ? 'pointer' : 'default'}
          onClick={
            isConfigured && !isActive
              ? () => setIsExpanded((v) => !v)
              : undefined
          }
          // Active: override border + suppress hover background
          {...(isActive && {
            borderColor: 'primary.500',
            boxShadow: '0 0 0 3px var(--chakra-colors-primary-100)',
            _hover: { bg: 'white', cursor: 'default' },
          })}
          // Pending: suppress hover
          {...(isPending && {
            _hover: { bg: 'white', cursor: 'default' },
          })}
        >
          <Flex {...flowStepStyles.topHeader} py={isNested ? 3 : 4}>
            <StepAppIcon
              isCompleted={isConfigured}
              isNested={isNested}
              isTestSuccessful={isConfigured ? true : undefined}
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

            {/* Chevron for configured accordion toggle */}
            {isConfigured && !isActive && (
              <Icon
                as={isExpanded ? RiArrowUpSLine : RiArrowDownSLine}
                boxSize={5}
                color="base.content.medium"
                flexShrink={0}
                ml={2}
              />
            )}
          </Flex>

          {showParams && (
            <StepParameterRows
              parameters={parameters}
              appKey={step.appKey ?? ''}
              stepKey={step.key ?? ''}
              stepId={step.id ?? ''}
              connectionLabel={step.connectionLabel}
              stepNameById={stepNameById}
            />
          )}
        </Flex>
      </Flex>
      {!isLastStep && (
        <Flex justifyContent="center" h={isNested ? 6 : 12}>
          <Divider orientation="vertical" borderColor="base.divider.medium" />
        </Flex>
      )}
    </Flex>
  )
}

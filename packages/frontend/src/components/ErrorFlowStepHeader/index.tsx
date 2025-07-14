import type { IStep } from '@plumber/types'

import { useContext } from 'react'
import { BiInfoCircle } from 'react-icons/bi'
import { Flex, Icon, Text } from '@chakra-ui/react'

import { SUPPORT_FORM_LINK } from '@/config/urls'
import { EditorContext } from '@/contexts/Editor'
import { getFlowStepHeaderWidth } from '@/helpers/editor'

import StepDeleteButton from '../FlowStep/components/StepDeleteButton'

interface ErrorFlowStepHeaderProps {
  step: IStep
  isNested?: boolean
}

export default function ErrorFlowStepHeader(props: ErrorFlowStepHeaderProps) {
  const { isNested, step } = props
  const { isDrawerOpen, isMobile } = useContext(EditorContext)

  return (
    <Flex
      h={isNested ? '48px' : '64px'}
      alignItems="center"
      bg="interaction.warning-subtle.default"
      borderColor="interaction.warning.default"
      borderRadius="lg"
      borderWidth="1px"
      gap={4}
      p={4}
      w={getFlowStepHeaderWidth(isDrawerOpen, isMobile, isNested)}
      _hover={{
        bg: 'interaction.warning-subtle.default',
        '& .hover-remove-button': {
          visibility: 'visible',
        },
      }}
    >
      <Icon as={BiInfoCircle} boxSize={6} color="interaction.warning.hover" />
      <Flex flexDirection="column" gap={1} py={isNested ? 2 : 4}>
        <Text textStyle="subhead-2">
          Something went wrong, delete this step and try again.
        </Text>
        <Text textStyle="caption-1">
          If this issue persists, contact us at{' '}
          <a href={SUPPORT_FORM_LINK} target="_blank" rel="noreferrer">
            {SUPPORT_FORM_LINK}
          </a>
        </Text>
      </Flex>
      <StepDeleteButton isNested={isNested} step={step} />
    </Flex>
  )
}

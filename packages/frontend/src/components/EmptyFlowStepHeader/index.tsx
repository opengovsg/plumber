import type { IStep } from '@plumber/types'

import { BiRun, BiSolidBolt } from 'react-icons/bi'
import { Flex, Icon, Text, useDisclosure } from '@chakra-ui/react'

import EmptyFlowStepHeaderModal from './EmptyFlowStepHeaderModal'

interface EmptyFlowStepHeaderProps {
  step: IStep
  isLastStep: boolean
  onChange: ({ step }: { step: IStep }) => void
  onSubmit: () => void
}

export default function EmptyFlowStepHeader(
  props: EmptyFlowStepHeaderProps,
): JSX.Element {
  const { step, isLastStep, onChange, onSubmit } = props
  const { isOpen, onOpen, onClose } = useDisclosure()

  const isTrigger = step.type === 'trigger'
  return (
    <>
      <Flex
        w="full"
        borderWidth="1px"
        borderColor="base.divider.medium"
        borderRadius="lg"
        bg="white"
        p={4}
        justifyContent="center"
        alignItems="center"
        gap={4}
        onClick={onOpen}
        _hover={{
          bg: 'interaction.muted.neutral.hover',
          cursor: 'pointer',
        }}
        _active={{
          bg: 'interaction.muted.neutral.active',
        }}
      >
        <Icon as={isTrigger ? BiSolidBolt : BiRun} />
        <Text>
          {isTrigger
            ? 'Choose how you want your workflow to start'
            : 'Choose which action you want to run next'}
        </Text>
      </Flex>

      <EmptyFlowStepHeaderModal
        isOpen={isOpen}
        onClose={onClose}
        step={step}
        isLastStep={isLastStep}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    </>
  )
}

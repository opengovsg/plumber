import { BiPlus } from 'react-icons/bi'
import { Divider, Flex, useDisclosure } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import FlowStepConfigurationModal from '@/components/FlowStepConfigurationModal'

interface CompactAddStepButtonProps {
  isDisabled: boolean
  isDrawerOpen: boolean
  isLastStep: boolean
  prevStepId: string
}

export function HoverAddStepButton(
  props: CompactAddStepButtonProps,
): JSX.Element {
  const { isDisabled, isLastStep, prevStepId } = props
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <>
      <Flex
        role="group"
        w="full"
        pos="relative"
        h={6}
        alignItems="center"
        justifyContent="center"
        direction="row"
        transition="all 0.2s ease-in-out"
        _hover={{
          cursor: 'pointer',
          '& .add-button': {
            opacity: 1,
            transform: 'scale(1)',
          },
          h: 8,
          my: 1,
          borderRadius: 'lg',
        }}
        pointerEvents={isDisabled ? 'none' : 'auto'}
      >
        {/* vertical line */}
        {!isLastStep && (
          <Flex h="1.5rem" opacity={1} _groupHover={{ display: 'none' }}>
            <Divider orientation="vertical" borderColor="base.divider.strong" />
          </Flex>
        )}
        {!isDisabled && (
          <Button
            aria-label="Add Step"
            className="add-button"
            position="absolute"
            opacity={0}
            transition="all 0.2s ease-in-out"
            w="full"
            onClick={onOpen}
            isDisabled={isDisabled}
            variant="clear"
            size="xs"
          >
            <BiPlus />
          </Button>
        )}
      </Flex>

      {isOpen && (
        <FlowStepConfigurationModal
          onClose={onClose}
          isTrigger={false} // Can only add an action all the time
          isLastStep={isLastStep}
          prevStepId={prevStepId}
        />
      )}
    </>
  )
}

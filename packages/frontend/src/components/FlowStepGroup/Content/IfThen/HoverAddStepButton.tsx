import { useState } from 'react'
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
  const [isHovered, setIsHovered] = useState(false)

  return (
    <>
      <Flex
        role="group"
        w="full"
        pos="relative"
        h={isHovered ? 8 : 6}
        alignItems="center"
        justifyContent="center"
        direction="row"
        m={1}
        pointerEvents={isDisabled ? 'none' : 'auto'}
        transition="all 0.3s ease"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* vertical line */}
        {!isLastStep && (
          <Flex h="2rem" opacity={1} _groupHover={{ display: 'none' }}>
            <Divider orientation="vertical" borderColor="base.divider.strong" />
          </Flex>
        )}
        {!isDisabled && isHovered && (
          <Button
            aria-label="Add Step"
            className="add-button"
            position="absolute"
            opacity={1}
            transition="height 0.2s ease-in-out"
            w="full"
            onClick={onOpen}
            isDisabled={isDisabled}
            variant="clear"
            size="xs"
            borderRadius="lg"
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

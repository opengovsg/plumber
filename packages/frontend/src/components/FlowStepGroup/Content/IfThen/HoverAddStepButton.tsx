import { useState } from 'react'
import { BiPlus } from 'react-icons/bi'
import { Divider, Flex, IconButton, useDisclosure } from '@chakra-ui/react'

import FlowStepConfigurationModal from '@/components/FlowStepConfigurationModal'

import { hoverAddStepButtonStyles as styles } from './styles'

interface HoverAddStepButtonProps {
  isDisabled: boolean
  isDrawerOpen: boolean
  isLastStep: boolean
  prevStepId: string
}

export function HoverAddStepButton(
  props: HoverAddStepButtonProps,
): JSX.Element {
  const { isDisabled, isLastStep, prevStepId } = props
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [isHovered, setIsHovered] = useState(false)

  return (
    <>
      <Flex
        {...styles.container}
        h={isHovered ? 8 : isLastStep ? 4 : 6}
        mb={isLastStep ? 0 : 1}
        pointerEvents={isDisabled ? 'none' : 'auto'}
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
          <IconButton
            {...styles.button}
            aria-label="Add Step"
            onClick={onOpen}
            isDisabled={isDisabled}
            icon={<BiPlus />}
          />
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

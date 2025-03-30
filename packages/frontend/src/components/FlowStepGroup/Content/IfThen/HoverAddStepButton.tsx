import { BiPlus } from 'react-icons/bi'
import { Divider, Flex } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

interface CompactAddStepButtonProps {
  onClick: () => void
  isDisabled: boolean
  isLastStep: boolean
}

export function HoverAddStepButton(
  props: CompactAddStepButtonProps,
): JSX.Element {
  const { onClick, isDisabled, isLastStep } = props

  return (
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
        m: 1,
        borderRadius: 'lg',
      }}
    >
      {/* vertical line */}
      {!isLastStep && (
        <Flex h="1.5rem" opacity={1} _groupHover={{ display: 'none' }}>
          <Divider orientation="vertical" borderColor="base.divider.strong" />
        </Flex>
      )}
      <Button
        aria-label="Add Step"
        className="add-button"
        position="absolute"
        opacity={0}
        transition="all 0.2s ease-in-out"
        w="full"
        onClick={onClick}
        isDisabled={isDisabled}
        variant="outline"
        size="xs"
      >
        <BiPlus />
      </Button>
    </Flex>
  )
}

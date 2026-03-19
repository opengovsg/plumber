import { IoChevronDown } from 'react-icons/io5'
import { IconButton } from '@chakra-ui/react'
import { useStickToBottomContext } from 'use-stick-to-bottom'

export default function ScrollButton() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()

  if (isAtBottom) {
    return null
  }

  return (
    <IconButton
      aria-label="Scroll to bottom"
      variant="clear"
      icon={<IoChevronDown />}
      onClick={() => scrollToBottom()}
      size="xs"
      borderRadius="full"
      border="1px"
      bg="white"
      _hover={{
        bg: 'interaction.muted.neutral.hover',
      }}
      position="absolute"
      top="-56px"
      left="50%"
      transform="translateX(-50%)"
      zIndex={10}
      boxShadow="md"
    />
  )
}

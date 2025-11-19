import { FaRegThumbsDown } from 'react-icons/fa'
import { Flex, Icon, IconButton, Tooltip } from '@chakra-ui/react'

const DEFAULT_BUTTON_PROPS = {
  size: 'xs',
  variant: 'clear',
  color: 'gray.500',
  _hover: { color: 'gray.700', bg: 'gray.100' },
}

export default function ChatMessageToolbar() {
  const handleThumbsDown = () => {
    // TODO: Implement feedback functionality
  }

  return (
    <Flex gap={1} mt={2}>
      <Tooltip label="Not helpful" placement="top">
        <IconButton
          {...DEFAULT_BUTTON_PROPS}
          aria-label="Thumbs down"
          icon={<Icon as={FaRegThumbsDown} />}
          onClick={handleThumbsDown}
        />
      </Tooltip>
    </Flex>
  )
}

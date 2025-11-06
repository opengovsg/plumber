import { FaRegCopy, FaRegThumbsDown } from 'react-icons/fa'
import { FaCheck } from 'react-icons/fa6'
import { Flex, Icon, IconButton, Tooltip } from '@chakra-ui/react'

import { Message } from '@/hooks/useChatStream'

interface ChatMessageToolbarProps {
  message: Message
  index: number
  copiedIndex: number | null
  setCopiedIndex: (index: number | null) => void
  onOpenDrawer: () => void
}

const DEFAULT_BUTTON_PROPS = {
  size: 'xs',
  variant: 'clear',
  color: 'gray.500',
  _hover: { color: 'gray.700', bg: 'gray.100' },
}

export default function ChatMessageToolbar({
  message,
  index,
  copiedIndex,
  setCopiedIndex,
}: ChatMessageToolbarProps) {
  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

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
      <Tooltip
        label={copiedIndex === index ? 'Copied!' : 'Copy '}
        placement="top"
      >
        <IconButton
          {...DEFAULT_BUTTON_PROPS}
          aria-label="Copy"
          icon={<Icon as={copiedIndex === index ? FaCheck : FaRegCopy} />}
          onClick={() => handleCopy(message.text, index)}
        />
      </Tooltip>
      {/* TODO: Add preview button */}
    </Flex>
  )
}

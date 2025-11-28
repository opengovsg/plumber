import { Box, Flex } from '@chakra-ui/react'

import { Message } from '@/hooks/useChatStream'
import { ChakraStreamdown } from '@/theme/components/Streamdown'

import ChatMessageToolbar from './ChatMessageToolbar'
import PlumberAvatar from './PlumberAvatar'

interface AiMessageProps {
  message: Message
}

const AiMessage = ({ message }: AiMessageProps) => {
  return (
    <Flex gap={3} w="full" align="start">
      <PlumberAvatar mt={3} />
      <Box flex={1} color="gray.900">
        <ChakraStreamdown isAnimating={false}>
          {message.text || ''}
        </ChakraStreamdown>
        <ChatMessageToolbar />
      </Box>
    </Flex>
  )
}

export default AiMessage

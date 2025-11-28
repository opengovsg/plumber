import { Box, Flex, Text } from '@chakra-ui/react'

import { Message } from '@/hooks/useChatStream'

interface UserMessageProps {
  message: Message
}

const UserMessage = ({ message }: UserMessageProps) => {
  return (
    <Flex justify="flex-end">
      <Box
        maxW="80%"
        bg="gray.100"
        color="gray.900"
        px={4}
        py={3}
        borderRadius="lg"
      >
        <Text fontSize="sm" whiteSpace="pre-wrap">
          {message.text}
        </Text>
      </Box>
    </Flex>
  )
}

export default UserMessage

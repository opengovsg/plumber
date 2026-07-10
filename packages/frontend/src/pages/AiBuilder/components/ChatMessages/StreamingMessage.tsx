import { Box, Flex } from '@chakra-ui/react'

import { stripHtmlComments } from '@/pages/AiBuilder/helpers'
import { ChakraStreamdown } from '@/theme/components/Streamdown'

import Loader from './Loader'

interface StreamingMessageProps {
  currentResponse: string
}

const StreamingMessage = ({ currentResponse }: StreamingMessageProps) => {
  if (currentResponse) {
    return (
      <Flex gap={3} w="full" align="start">
        <Box flex={1} px={2} color="gray.900">
          <ChakraStreamdown isAnimating={true}>
            {stripHtmlComments(currentResponse)}
          </ChakraStreamdown>
        </Box>
      </Flex>
    )
  }

  return (
    <Flex gap={3} w="full" alignItems="center">
      Thinking
      <Loader />
    </Flex>
  )
}

export default StreamingMessage

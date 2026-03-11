import { Box, Flex } from '@chakra-ui/react'

import { ChakraStreamdown } from '@/theme/components/Streamdown'

import Loader from './Loader'
import PlumberAvatar from './PlumberAvatar'

interface StreamingMessageProps {
  currentResponse: string
}

const StreamingMessage = ({ currentResponse }: StreamingMessageProps) => {
  if (currentResponse) {
    return (
      <Flex gap={3} w="full" align="start">
        <PlumberAvatar mt={3} />
        <Box flex={1} color="gray.900">
          <ChakraStreamdown isAnimating={true}>
            {currentResponse}
          </ChakraStreamdown>
        </Box>
      </Flex>
    )
  }

  return (
    <Flex gap={3} w="full" alignItems="center">
      <PlumberAvatar />
      <Loader />
    </Flex>
  )
}

export default StreamingMessage

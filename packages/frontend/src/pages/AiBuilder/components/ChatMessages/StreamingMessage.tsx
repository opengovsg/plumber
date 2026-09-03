import { Box, Flex } from '@chakra-ui/react'

import { prepareAiText } from '@/pages/AiBuilder/helpers'
import { ChakraStreamdown } from '@/theme/components/Streamdown'

import Loader from './Loader'

interface StreamingMessageProps {
  currentResponse: string
  /** Stream is open but no text is arriving, e.g. a tool is running server-side. */
  showWorkingIndicator: boolean
}

const WorkingIndicator = ({ label }: { label: string }) => (
  <Flex
    gap={3}
    w="full"
    alignItems="center"
    textStyle="subhead-2"
    textTransform="uppercase"
    fontWeight={500}
    color="gray.500"
  >
    {label}
    <Loader />
  </Flex>
)

const StreamingMessage = ({
  currentResponse,
  showWorkingIndicator,
}: StreamingMessageProps) => {
  if (currentResponse) {
    return (
      <Flex gap={3} w="full" align="start">
        <Box flex={1} px={2} py={2} color="gray.900">
          <ChakraStreamdown isAnimating={true}>
            {prepareAiText(currentResponse)}
          </ChakraStreamdown>
          {showWorkingIndicator && (
            <Box mt={2}>
              <WorkingIndicator label="Working" />
            </Box>
          )}
        </Box>
      </Flex>
    )
  }

  return <WorkingIndicator label="Thinking" />
}

export default StreamingMessage

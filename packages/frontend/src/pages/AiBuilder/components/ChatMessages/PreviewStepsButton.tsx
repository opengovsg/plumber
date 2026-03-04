import { MdOutlineRemoveRedEye } from 'react-icons/md'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Flex } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { Message } from '@/hooks/useChatStream'
import { ChakraStreamdown } from '@/theme/components/Streamdown'

import PlumberAvatar from './PlumberAvatar'

const PreviewStepsButton = ({
  messages,
  onOpenDrawer,
}: {
  messages: Message[]
  onOpenDrawer: () => void
}) => {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <Flex gap={3} w="full" align="start">
      <PlumberAvatar />
      <Box flex={1} color="gray.900">
        <ChakraStreamdown isAnimating={false}>
          Satisfied with your workflow?
        </ChakraStreamdown>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigate(location.pathname, {
              state: {
                ...location.state,
                chatInput: messages[messages.length - 1].text,
                chatMessages: messages,
              },
              replace: true,
            })
            onOpenDrawer()
          }}
          mt={2}
          leftIcon={<MdOutlineRemoveRedEye />}
          bg="white"
        >
          Preview steps
        </Button>
      </Box>
    </Flex>
  )
}

export default PreviewStepsButton

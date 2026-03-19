import { Box, Button, Flex, Text } from '@chakra-ui/react'

interface MessageLimitBannerProps {
  onNewChat: () => void
}

export default function MessageLimitBanner({
  onNewChat,
}: MessageLimitBannerProps) {
  return (
    <Box
      bg="utility.feedback.warning-subtle"
      px={4}
      py={3}
      borderRadius="md"
      border="1px"
      borderColor="utility.feedback.warning"
    >
      <Flex alignItems="center" justifyContent="space-between" gap={4}>
        <Text textStyle="body-1">
          You&apos;ve reached the message limit. Copy the summary above and
          start a new chat.
        </Text>
        <Button
          onClick={onNewChat}
          colorScheme="primary"
          size="sm"
          flexShrink={0}
        >
          New Chat
        </Button>
      </Flex>
    </Box>
  )
}

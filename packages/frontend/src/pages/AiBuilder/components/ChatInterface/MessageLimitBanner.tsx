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
          Message limit reached. Your progress will carry over when you continue
          in a new chat.
        </Text>
        <Button
          onClick={onNewChat}
          colorScheme="primary"
          size="xs"
          flexShrink={0}
        >
          Continue in new chat
        </Button>
      </Flex>
    </Box>
  )
}

import { Box, Button, Flex, Text } from '@chakra-ui/react'

interface MessageLimitBannerProps {
  /** `size` means the server rejected the request body, so a retry would fail again. */
  reason: 'messages' | 'size'
  onNewChat: () => void
  onRetry?: () => void
}

export default function MessageLimitBanner({
  reason,
  onNewChat,
  onRetry: onRetryProp,
}: MessageLimitBannerProps) {
  const onRetry = reason === 'size' ? undefined : onRetryProp
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
          {reason === 'size'
            ? 'This chat is too long to continue. Start a new chat to keep working on your pipe.'
            : onRetry
              ? 'Message limit reached. The last response was stopped. Retry it to carry your progress over to a new chat.'
              : 'Message limit reached. Your progress will carry over when you continue in a new chat.'}
        </Text>
        <Flex gap={2} flexShrink={0}>
          {onRetry && (
            <Button onClick={onRetry} colorScheme="primary" size="xs">
              Retry
            </Button>
          )}
          <Button
            onClick={onNewChat}
            colorScheme="primary"
            variant={onRetry ? 'outline' : 'solid'}
            size="xs"
          >
            Continue in new chat
          </Button>
        </Flex>
      </Flex>
    </Box>
  )
}

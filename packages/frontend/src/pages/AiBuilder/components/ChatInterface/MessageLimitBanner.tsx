import { Box, Button, Flex, Text } from '@chakra-ui/react'

interface MessageLimitBannerProps {
  onNewChat: () => void
  onRetry?: () => void
}

export default function MessageLimitBanner({
  onNewChat,
  onRetry,
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
          {onRetry
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

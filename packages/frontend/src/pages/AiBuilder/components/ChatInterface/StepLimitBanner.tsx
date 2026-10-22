import { Box, Button, Flex, Text } from '@chakra-ui/react'

interface StepLimitBannerProps {
  onContinue: () => void
}

export default function StepLimitBanner({ onContinue }: StepLimitBannerProps) {
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
          The assistant paused before it finished. Your progress is saved.
        </Text>
        <Button
          onClick={onContinue}
          colorScheme="primary"
          size="xs"
          flexShrink={0}
        >
          Continue
        </Button>
      </Flex>
    </Box>
  )
}

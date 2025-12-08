import { Flex } from '@chakra-ui/react'

import { FeedbackButton } from './FeedbackButton'

interface ChatMessageToolbarProps {
  traceId: string
}

export default function ChatMessageToolbar({
  traceId,
}: ChatMessageToolbarProps) {
  return (
    <Flex gap={1} mt={2}>
      <FeedbackButton feedbackType="negative" traceId={traceId} />
      <FeedbackButton feedbackType="positive" traceId={traceId} />
    </Flex>
  )
}

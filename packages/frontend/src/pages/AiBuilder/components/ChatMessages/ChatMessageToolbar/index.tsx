import { useState } from 'react'
import { Button, Flex } from '@chakra-ui/react'

import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'

import { FeedbackButton } from './FeedbackButton'

interface ChatMessageToolbarProps {
  traceId: string
  shouldShowPreviewButton?: boolean
}

export default function ChatMessageToolbar({
  traceId,
  shouldShowPreviewButton,
}: ChatMessageToolbarProps) {
  const { setIsDrawerOpen } = useAiBuilderContext()
  const [submittedFeedback, setSubmittedFeedback] = useState<
    'positive' | 'negative' | null
  >(null)

  const handleFeedbackSubmit = (type: 'positive' | 'negative') => {
    setSubmittedFeedback(type)
  }

  const handleFeedbackReset = () => {
    setSubmittedFeedback(null)
  }

  return (
    <>
      {shouldShowPreviewButton && (
        <Flex gap={1} alignItems="center" bottom={4} right={4} zIndex={5}>
          <Button size="md" width="full" onClick={() => setIsDrawerOpen(true)}>
            Preview workflow
          </Button>
        </Flex>
      )}
      <Flex gap={1} mt={2}>
        {submittedFeedback !== 'negative' && (
          <FeedbackButton
            feedbackType="positive"
            traceId={traceId}
            onFeedbackSubmit={handleFeedbackSubmit}
            onFeedbackReset={handleFeedbackReset}
            isSubmitted={submittedFeedback === 'positive'}
          />
        )}
        {submittedFeedback !== 'positive' && (
          <FeedbackButton
            feedbackType="negative"
            traceId={traceId}
            onFeedbackSubmit={handleFeedbackSubmit}
            onFeedbackReset={handleFeedbackReset}
            isSubmitted={submittedFeedback === 'negative'}
          />
        )}
      </Flex>
    </>
  )
}

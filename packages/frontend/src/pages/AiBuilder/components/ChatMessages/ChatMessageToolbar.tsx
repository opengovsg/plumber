import React, { useRef, useState } from 'react'
import { FaRegThumbsDown, FaRegThumbsUp } from 'react-icons/fa'
import {
  Button,
  ButtonGroup,
  Flex,
  FocusLock,
  FormControl,
  FormLabel,
  Icon,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Stack,
  Textarea,
  useDisclosure,
} from '@chakra-ui/react'
import { useToast } from '@opengovsg/design-system-react'

interface ChatMessageToolbarProps {
  traceId: string
}

interface FeedbackButtonProps {
  feedbackType: 'positive' | 'negative'
  traceId: string
}

const FeedbackButton = ({ feedbackType, traceId }: FeedbackButtonProps) => {
  const { onOpen, onClose, isOpen } = useDisclosure()
  const firstFieldRef = useRef(null)
  const toast = useToast()
  const icon = feedbackType === 'positive' ? FaRegThumbsUp : FaRegThumbsDown
  const formLabel =
    feedbackType === 'positive'
      ? 'What was helpful about this?'
      : 'Why was this not helpful?'
  const score = feedbackType === 'positive' ? 1 : 0

  const [feedback, setFeedback] = useState('')

  const handleSubmitFeedback = async (comment: string) => {
    try {
      if (!traceId) {
        return
      }

      // NOTE: we send feedback to the backend instead of using Langfuse directly
      // as there are additional headers required to call Rome/Istanbul endpoints
      // that should not be exposed to the frontend
      await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traceId, feedback, score }),
      })
    } catch {
      // don't throw error if feedback submission fails
      // as it is not critical to the user experience
    } finally {
      // NOTE: do not reset comment here
      // so that user will see what they previously typed or submitted
      // if they attempt to submit again
      onClose()
      toast({
        title: "Thank you! We've sent your feedback to the Plumber team.",
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
    }
  }

  return (
    <Popover
      isOpen={isOpen}
      initialFocusRef={firstFieldRef}
      onOpen={onOpen}
      onClose={onClose}
    >
      <PopoverTrigger>
        <IconButton
          variant="clear"
          colorScheme="secondary"
          aria-label="Thumbs down"
          icon={<Icon as={icon} />}
          onClick={onOpen}
        />
      </PopoverTrigger>
      <PopoverContent>
        <FocusLock persistentFocus={false}>
          <PopoverArrow />

          <PopoverBody>
            <Stack spacing={4}>
              <FormControl>
                <FormLabel htmlFor="feedback-details">{formLabel}</FormLabel>
                <Textarea
                  ref={firstFieldRef}
                  id="feedback-details"
                  rows={3}
                  resize="none"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </FormControl>
              <ButtonGroup display="flex" justifyContent="flex-end">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  isDisabled={!feedback}
                  onClick={() => handleSubmitFeedback(feedback)}
                >
                  Submit
                </Button>
              </ButtonGroup>
            </Stack>
          </PopoverBody>
        </FocusLock>
      </PopoverContent>
    </Popover>
  )
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

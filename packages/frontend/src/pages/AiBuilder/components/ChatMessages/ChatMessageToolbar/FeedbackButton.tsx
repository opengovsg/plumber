import { FaRegThumbsDown, FaRegThumbsUp } from 'react-icons/fa'
import { useMutation } from '@apollo/client'
import {
  Button,
  ButtonGroup,
  FocusLock,
  FormControl,
  Icon,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Stack,
  useDisclosure,
} from '@chakra-ui/react'
import { useToast } from '@opengovsg/design-system-react'

import Form from '@/components/Form'
import { UPDATE_CHAT_FEEDBACK } from '@/graphql/mutations/ai/update-chat-feedback'

import { FEEDBACK_POPOVER_DETAILS } from './constants'
import FeedbackFormContent from './FeedbackFormContent'

interface FeedbackFormData {
  'feedback-dropdown'?: string
  'feedback-details': string
}

interface FeedbackButtonProps {
  feedbackType: 'positive' | 'negative'
  traceId: string
}

export const FeedbackButton = ({
  feedbackType,
  traceId,
}: FeedbackButtonProps) => {
  const { onOpen, onClose, isOpen } = useDisclosure()
  const toast = useToast()
  const icon = feedbackType === 'positive' ? FaRegThumbsUp : FaRegThumbsDown
  const [updateChatFeedback] = useMutation(UPDATE_CHAT_FEEDBACK)
  const {
    dropdownLabel,
    dropdownOptions,
    textAreaLabel,
    textAreaPlaceholder,
    score,
  } = FEEDBACK_POPOVER_DETAILS[feedbackType]

  const handleSubmitFeedback = async (data: FeedbackFormData) => {
    try {
      if (!traceId) {
        return
      }

      // NOTE: we send feedback to the backend instead of using Langfuse directly
      // as there are additional headers required to call Rome/Istanbul endpoints
      // that should not be exposed to the frontend
      await updateChatFeedback({
        variables: {
          input: {
            traceId,
            feedback: {
              category: data['feedback-dropdown'],
              comment: data['feedback-details'],
            },
            score,
          },
        },
      })
    } catch {
      // don't throw error if feedback submission fails
      // as it is not critical to the user experience
    } finally {
      // NOTE: do not reset form here
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
      onOpen={onOpen}
      onClose={onClose}
      placement="top-start"
    >
      <PopoverTrigger>
        <IconButton
          variant="clear"
          colorScheme="secondary"
          aria-label={feedbackType === 'positive' ? 'Thumbs up' : 'Thumbs down'}
          icon={<Icon as={icon} />}
          onClick={onOpen}
          // HACKFIX(kevinkim-ogp): prevent autofocus when new input is sent
          tabIndex={-1}
        />
      </PopoverTrigger>
      <PopoverContent>
        <FocusLock persistentFocus={false}>
          <PopoverArrow />

          <PopoverBody p={4}>
            <Form
              onSubmit={(data) =>
                handleSubmitFeedback(data as FeedbackFormData)
              }
            >
              <Stack spacing={4}>
                <FormControl>
                  <FeedbackFormContent
                    dropdownLabel={dropdownLabel}
                    dropdownOptions={dropdownOptions}
                    textAreaLabel={textAreaLabel}
                    textAreaPlaceholder={textAreaPlaceholder}
                    autoFocus={feedbackType === 'positive'}
                  />
                </FormControl>
                <ButtonGroup display="flex" justifyContent="flex-end">
                  <Button variant="clear" onClick={onClose} size="xs">
                    Cancel
                  </Button>
                  <Button type="submit" size="xs">
                    Submit
                  </Button>
                </ButtonGroup>
              </Stack>
            </Form>
          </PopoverBody>
        </FocusLock>
      </PopoverContent>
    </Popover>
  )
}

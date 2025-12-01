import { Controller, useFormContext } from 'react-hook-form'
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

import Form from '@/components/Form'
import { SingleSelect } from '@/components/SingleSelect'

interface FeedbackFormData {
  'feedback-dropdown'?: string
  'feedback-details': string
}

interface ChatMessageToolbarProps {
  traceId: string
}

interface FeedbackButtonProps {
  feedbackType: 'positive' | 'negative'
  traceId: string
}

const FEEDBACK_POPOVER_DETAILS = {
  positive: {
    dropdownLabel: null,
    dropdownOptions: null,
    textAreaLabel:
      'Provide details on what was satisfying about this response:',
    textAreaPlaceholder: 'What was satisfying about this response?',
    score: 1,
  },
  negative: {
    dropdownLabel: 'What type of issue do you wish to report?',
    dropdownOptions: [
      'Incorrect workflow generated',
      'Incomplete response',
      'UI bug',
      "I don't understand the response",
      'Other',
    ],
    textAreaLabel: 'Provide details on what was wrong with this response:',
    textAreaPlaceholder: 'What was wrong with this response?',
    score: 0,
  },
}

const FeedbackFormContent = ({
  dropdownLabel,
  dropdownOptions,
  textAreaLabel,
  textAreaPlaceholder,
  autoFocus,
}: {
  dropdownLabel: string | null
  dropdownOptions: string[] | null
  textAreaLabel: string
  textAreaPlaceholder: string
  autoFocus?: boolean
}) => {
  const { control, register } = useFormContext<FeedbackFormData>()

  return (
    <Flex direction="column">
      {dropdownLabel != null && dropdownOptions != null && (
        <>
          <FormLabel htmlFor="feedback-dropdown" mt={2}>
            {dropdownLabel}
          </FormLabel>
          <Controller
            name="feedback-dropdown"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <SingleSelect
                colorScheme="secondary"
                name="feedback-dropdown"
                items={dropdownOptions}
                value={field.value ?? ''}
                onChange={field.onChange}
                isClearable={false}
              />
            )}
          />
        </>
      )}
      <FormLabel htmlFor="feedback-details" mt={2}>
        {textAreaLabel}
      </FormLabel>
      <Textarea
        id="feedback-details"
        rows={3}
        resize="none"
        autoFocus={autoFocus}
        placeholder={textAreaPlaceholder}
        {...register('feedback-details')}
      />
    </Flex>
  )
}

const FeedbackButton = ({ feedbackType, traceId }: FeedbackButtonProps) => {
  const { onOpen, onClose, isOpen } = useDisclosure()
  const toast = useToast()
  const icon = feedbackType === 'positive' ? FaRegThumbsUp : FaRegThumbsDown
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
      await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          traceId,
          feedback: {
            category: data['feedback-dropdown'],
            comment: data['feedback-details'],
          },
          score,
        }),
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
          aria-label="Thumbs down"
          icon={<Icon as={icon} />}
          onClick={onOpen}
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
                  <Button variant="clear" onClick={onClose} size="sm">
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
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

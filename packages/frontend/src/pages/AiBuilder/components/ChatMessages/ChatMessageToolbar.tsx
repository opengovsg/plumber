import React, { useState } from 'react'
import { FaRegThumbsDown } from 'react-icons/fa'
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

export default function ChatMessageToolbar({
  traceId,
}: ChatMessageToolbarProps) {
  const { onOpen, onClose, isOpen } = useDisclosure()
  const toast = useToast()
  const firstFieldRef = React.useRef(null)
  const [comment, setComment] = useState('')

  const handleSubmitFeedback = async (comment: string) => {
    try {
      if (!traceId) {
        return
      }

      // NOTE: we send feedback to the backend instead of using Langfuse directly
      // as there are additional headers required to call Rome/Istanbul endpoints
      // that should not be exposed to the frontend
      await fetch('/api/chat-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traceId, feedback: comment }),
      })
    } catch {
      // don't throw error if feedback submission fails
      // as it is not critical to the user experience
    } finally {
      onClose()
      setComment('')
      toast({
        title: "Thank you! We've sent your feeback to the Plumber team.",
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
    }
  }

  return (
    <Flex gap={1} mt={2}>
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
            icon={<Icon as={FaRegThumbsDown} />}
            onClick={onOpen}
          />
        </PopoverTrigger>
        <PopoverContent>
          <FocusLock persistentFocus={false}>
            <PopoverArrow />

            <PopoverBody>
              <Stack spacing={4}>
                <FormControl>
                  <FormLabel htmlFor="why-not-helpful">
                    Why was this not helpful?
                  </FormLabel>
                  <Textarea
                    ref={firstFieldRef}
                    id="why-not-helpful"
                    rows={3}
                    resize="none"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </FormControl>
                <ButtonGroup display="flex" justifyContent="flex-end">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    isDisabled={!comment}
                    colorScheme="teal"
                    onClick={() => handleSubmitFeedback(comment)}
                  >
                    Submit feedback
                  </Button>
                </ButtonGroup>
              </Stack>
            </PopoverBody>
          </FocusLock>
        </PopoverContent>
      </Popover>
    </Flex>
  )
}

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
import { LangfuseWeb } from 'langfuse'

import appConfig from '@/config/app'

const langfuse = new LangfuseWeb({
  baseUrl: appConfig.pairRomeBaseUrl,
  publicKey: appConfig.pairRomePublicKey,
})

const DEFAULT_BUTTON_PROPS = {
  size: 'xs',
  variant: 'clear',
  color: 'gray.500',
  _hover: { color: 'gray.700', bg: 'gray.100' },
}

interface ChatMessageToolbarProps {
  traceId: string
}

export default function ChatMessageToolbar({
  traceId,
}: ChatMessageToolbarProps) {
  const { onOpen, onClose, isOpen } = useDisclosure()
  const firstFieldRef = React.useRef(null)
  const [comment, setComment] = useState('')

  const handleSubmitFeedback = (comment: string) => {
    try {
      if (!traceId) {
        return
      }

      // Send feedback to Rome / Istanbul
      langfuse.score({
        traceId,
        id: `user-feedback-${traceId}`,
        name: 'user-feedback',
        value: 0, // 1 for positive, 0 for negative
        comment,
      })
    } catch (error) {
      console.error('Error submitting feedback:', error)
    } finally {
      onClose()
      setComment('')
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
            {...DEFAULT_BUTTON_PROPS}
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

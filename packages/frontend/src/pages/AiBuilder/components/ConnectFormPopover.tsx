import { useCallback, useRef, useState } from 'react'
import {
  Box,
  Button,
  Divider,
  Flex,
  Image,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  Text,
  Tooltip,
  useDisclosure,
} from '@chakra-ui/react'

import { stripFormIdPrefix } from '../helpers'

interface FormConnectionOption {
  name: string
  value: string
}

interface ConnectFormPopoverProps {
  isStreaming: boolean
  /** Called with the connection's full label and id when an existing form is picked. */
  onSelectExisting: (label: string, connectionId: string) => void
  /** Opens the Add-new-form modal. */
  onAddNewForm: () => void
}

/**
 * Empty-state "Connect your form" chip. Clicking it lists the user's existing
 * FormSG connections so they can reuse one instead of creating a duplicate;
 * users with no connections go straight to the Add-new-form modal.
 */
export default function ConnectFormPopover({
  isStreaming,
  onSelectExisting,
  onAddNewForm,
}: ConnectFormPopoverProps) {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [options, setOptions] = useState<FormConnectionOption[] | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Closing (Escape, outside click, or picking an option) doesn't unmount
  // this component — it stays mounted as a persistent composer chip — so a
  // fetch already in flight keeps running and would otherwise force-open
  // the Add-new-form modal via the fallback below well after the user
  // dismissed the popover. Abort it so a closed or superseded request can't
  // act on a stale result.
  const handleClose = useCallback(() => {
    abortRef.current?.abort()
    onClose()
  }, [onClose])

  const handleOpen = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setOptions(null)
    onOpen()

    try {
      const res = await fetch('/api/connections?appKey=formsg', {
        method: 'GET',
        credentials: 'include',
        signal: controller.signal,
      })
      if (!res.ok) {
        throw new Error(`Fetch failed: ${res.status}`)
      }
      const json = await res.json()
      const data: FormConnectionOption[] = json.data ?? []

      if (data.length === 0) {
        handleClose()
        onAddNewForm()
        return
      }
      setOptions(data)
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return
      }
      // Can't list existing connections — fall back to adding a new form.
      handleClose()
      onAddNewForm()
    }
  }

  return (
    <Popover isOpen={isOpen} onClose={handleClose} placement="top-start" isLazy>
      <Tooltip
        label="Most workflows start with a FormSG form. Connect yours and I'll guide you based on its actual fields."
        hasArrow
        placement="top-start"
        isDisabled={isOpen}
      >
        <Flex display="inline-flex">
          <PopoverTrigger>
            <Button
              variant="outline"
              size="xs"
              borderRadius="full"
              color="gray.700"
              borderColor="gray.200"
              fontWeight="medium"
              px={2.5}
              leftIcon={
                <Image
                  src="/apps/formsg/assets/favicon.svg"
                  boxSize="14px"
                  alt=""
                />
              }
              isDisabled={isStreaming}
              onClick={handleOpen}
            >
              Connect your form
            </Button>
          </PopoverTrigger>
        </Flex>
      </Tooltip>
      <PopoverContent w="320px" border="none" boxShadow="lg" borderRadius="lg">
        <PopoverBody p={2}>
          {options === null ? (
            <Flex justify="center" py={3}>
              <Spinner size="sm" color="primary.500" />
            </Flex>
          ) : (
            <Flex direction="column">
              <Text textStyle="caption-1" color="gray.500" px={2} py={1}>
                Choose a form to build with
              </Text>
              <Flex direction="column" maxH="240px" overflowY="auto">
                {options.map((opt, idx) => (
                  <Box
                    key={opt.value}
                    as="button"
                    type="button"
                    w="full"
                    textAlign="left"
                    px={3}
                    py={2}
                    borderRadius="md"
                    bg={idx % 2 === 0 ? 'gray.50' : 'white'}
                    _hover={{ bg: 'primary.50' }}
                    _active={{ bg: 'primary.100' }}
                    onClick={() => {
                      handleClose()
                      onSelectExisting(opt.name, opt.value)
                    }}
                  >
                    <Text
                      textStyle="body-2"
                      whiteSpace="normal"
                      color="gray.800"
                    >
                      {stripFormIdPrefix(opt.name)}
                    </Text>
                  </Box>
                ))}
              </Flex>
              <Divider my={1} />
              <Box
                as="button"
                type="button"
                w="full"
                textAlign="left"
                px={3}
                py={2}
                borderRadius="md"
                _hover={{ bg: 'primary.50' }}
                _active={{ bg: 'primary.100' }}
                onClick={() => {
                  handleClose()
                  onAddNewForm()
                }}
              >
                <Text
                  textStyle="body-2"
                  fontWeight="medium"
                  color="primary.500"
                >
                  Add a new form
                </Text>
              </Box>
            </Flex>
          )}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  )
}

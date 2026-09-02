import { useEffect, useRef, useState } from 'react'
import { FaArrowCircleUp } from 'react-icons/fa'
import { FaCircleStop } from 'react-icons/fa6'
import { Box, Button, Flex, Icon, Input, Spinner, Text } from '@chakra-ui/react'

import { AI_BUILDER_INLINE_CONNECT_APP_KEYS } from '@/pages/AiBuilder/constants'

interface DynamicPickerOption {
  name: string
  value: string
}

// Carries the backend's `{ error, code }` body for the catch handler below.
class DynamicDataFetchError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message)
  }
}

interface DynamicPickerProps {
  question: string
  stepId?: string
  dynamicKey?: string
  appKey?: string
  isStreaming: boolean
  onSelect: (name: string, value: string) => void
  onSkip: () => void
  /**
   * Step/key mode only: called once when a fetch returns zero options, or a
   * "prerequisite not saved" error — signals the LLM to self-troubleshoot.
   * `reason`, when present, is the backend's diagnostic (e.g. which
   * parameter is missing).
   */
  onNoOptionsFound?: (reason?: string) => void
  onAddConnection?: () => void
  /**
   * FormSG only: a form URL already shared in the conversation. When set,
   * the picker skips the connections list entirely and shows a single
   * "finish connecting" card — the user just adds their secret key for the
   * form they already chose.
   */
  knownFormUrl?: string
  cancelStream: () => void
}

export default function DynamicPicker({
  question,
  stepId,
  dynamicKey,
  appKey,
  isStreaming,
  onSelect,
  onSkip,
  onNoOptionsFound,
  onAddConnection,
  knownFormUrl,
  cancelStream,
}: DynamicPickerProps) {
  const [options, setOptions] = useState<DynamicPickerOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [query, setQuery] = useState('')
  const [selectedOption, setSelectedOption] =
    useState<DynamicPickerOption | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const isAppKeyMode = Boolean(appKey)

  // Forced key-completion mode: the form is already known from the
  // conversation, so listing other connections would only invite a mismatch.
  const isKnownFormMode = Boolean(
    isAppKeyMode && appKey === 'formsg' && knownFormUrl && onAddConnection,
  )

  useEffect(() => {
    if (isKnownFormMode) {
      setIsLoading(false)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setIsError(false)

    const fetchPromise = isAppKeyMode
      ? fetch(`/api/connections?appKey=${encodeURIComponent(appKey!)}`, {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
        })
      : fetch('/api/dynamic-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ stepId, key: dynamicKey }),
          signal: controller.signal,
        })

    fetchPromise
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new DynamicDataFetchError(
            res.status,
            body?.error ?? '',
            body?.code,
          )
        }
        return res.json()
      })
      .then((json) => {
        const data: DynamicPickerOption[] = json.data ?? []
        setOptions(data)

        // Auto-assign when exactly one connection is available (except FormSG,
        // which has a separate form-URL flow that requires user confirmation).
        if (isAppKeyMode && data.length === 1 && appKey !== 'formsg') {
          onSelect(data[0].name, data[0].value)
        }

        // Zero options is a real result — let the LLM self-troubleshoot.
        if (!isAppKeyMode && data.length === 0) {
          onNoOptionsFound?.()
        }
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') {
          return
        }
        setOptions([])

        // Step isn't configured yet — forward the reason to the LLM.
        if (
          !isAppKeyMode &&
          err instanceof DynamicDataFetchError &&
          err.code === 'prerequisite_missing'
        ) {
          onNoOptionsFound?.(err.message || undefined)
          return
        }

        setIsError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [stepId, dynamicKey, appKey, retryCount, isKnownFormMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = query
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options

  const hasOptions = !isLoading && options.length > 0

  const handleOptionClick = (opt: DynamicPickerOption) => {
    setSelectedOption(opt)
  }

  const handleSubmit = () => {
    if (!selectedOption || isStreaming) {
      return
    }
    onSelect(selectedOption.name, selectedOption.value)
  }

  // Zero options — distinct from a fetch error.
  const showEmptyState = !isLoading && !isError && options.length === 0

  // In-chat "add connection" entry point — FormSG (its own bespoke modal) or
  // any app key in AI_BUILDER_INLINE_CONNECT_APP_KEYS (the generic
  // AddAppConnection-based modal) — and only when the host page provided a
  // handler for it.
  const canAddConnection =
    Boolean(onAddConnection) &&
    (appKey === 'formsg' ||
      AI_BUILDER_INLINE_CONNECT_APP_KEYS.includes(
        appKey as (typeof AI_BUILDER_INLINE_CONNECT_APP_KEYS)[number],
      ))

  return (
    <Box w="full" maxW="4xl">
      <Box
        bg="white"
        border="1px"
        borderColor="gray.200"
        borderRadius="16px"
        boxShadow="0 2px 4px rgba(0,0,0,0.1)"
        p={4}
        w="full"
      >
        <Text mb={2}>{question}</Text>

        {hasOptions && (
          <Input
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            mb={2}
            borderColor="gray.200"
          />
        )}

        <Flex direction="column" gap={2} maxH="240px" overflowY="auto">
          {isKnownFormMode ? (
            <Flex
              direction="column"
              align="flex-start"
              gap={3}
              bg="gray.50"
              borderRadius="lg"
              p={4}
            >
              <Text textStyle="body-2" color="gray.700">
                We already have your form&apos;s URL — add your{' '}
                <Text as="span" fontWeight="medium">
                  Form Secret Key
                </Text>{' '}
                to connect it.
              </Text>
              <Button isDisabled={isStreaming} onClick={onAddConnection}>
                Connect your form
              </Button>
            </Flex>
          ) : isLoading ? (
            <Flex justify="center" py={4}>
              <Spinner size="sm" color="primary.500" />
            </Flex>
          ) : showEmptyState ? (
            isAppKeyMode ? (
              canAddConnection ? (
                <Button
                  variant="outline"
                  alignSelf="flex-start"
                  isDisabled={isStreaming}
                  onClick={onAddConnection}
                >
                  {appKey === 'formsg' ? 'Add your form' : 'Add connection'}
                </Button>
              ) : (
                <Text color="gray.500" fontSize="sm" px={2}>
                  No connections found for this app — you can add one in
                  Plumber&apos;s connection settings.
                </Text>
              )
            ) : (
              <Text color="gray.500" fontSize="sm" px={2}>
                No matching options were found for this field.
              </Text>
            )
          ) : hasOptions ? (
            filtered.length === 0 ? (
              <Text color="gray.400" fontSize="sm" px={2}>
                No results for &apos;{query}&apos;
              </Text>
            ) : (
              filtered.map((opt) => (
                <Button
                  key={opt.value}
                  variant="outline"
                  justifyContent="flex-start"
                  h="auto"
                  py={2}
                  isDisabled={isStreaming}
                  onClick={() => handleOptionClick(opt)}
                  borderColor={
                    selectedOption?.value === opt.value
                      ? 'primary.500'
                      : 'gray.200'
                  }
                  bg={
                    selectedOption?.value === opt.value ? 'primary.50' : 'white'
                  }
                  color="gray.800"
                  _hover={{ borderColor: 'primary.300', bg: 'primary.50' }}
                  _active={{ bg: 'primary.100' }}
                >
                  <Text textAlign="left" whiteSpace="normal" color="gray.800">
                    {opt.name}
                  </Text>
                </Button>
              ))
            )
          ) : isError ? (
            <Text color="red.400" fontSize="sm">
              {isAppKeyMode
                ? "Couldn't load connections. "
                : "Couldn't load options. "}
              <Text
                as="button"
                type="button"
                disabled={isStreaming}
                onClick={() => setRetryCount((c) => c + 1)}
                textDecoration="underline"
                fontWeight="medium"
                _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
              >
                Retry
              </Text>
            </Text>
          ) : null}
        </Flex>

        {/* Skip, submit-once-selected, add-a-new-form. No free text. */}
        <Box borderTop="1px" borderColor="gray.100" mt={4} pt={3}>
          <Flex justify="space-between" align="center">
            <Flex gap={4} align="center">
              <Button
                variant="link"
                size="sm"
                color="gray.400"
                isDisabled={isStreaming}
                onClick={onSkip}
                fontWeight="normal"
              >
                skip this step
              </Button>
              {canAddConnection && hasOptions && (
                <Button
                  variant="link"
                  size="sm"
                  color="primary.500"
                  isDisabled={isStreaming}
                  onClick={onAddConnection}
                  fontWeight="normal"
                >
                  {appKey === 'formsg'
                    ? 'Add a new form'
                    : 'Add a new connection'}
                </Button>
              )}
            </Flex>
            <Flex align="center" h="24px">
              {isStreaming ? (
                <Icon
                  as={FaCircleStop}
                  fontSize="24px"
                  color="red.500"
                  cursor="pointer"
                  onClick={cancelStream}
                  _hover={{ color: 'red.600' }}
                />
              ) : (
                selectedOption && (
                  <Icon
                    as={FaArrowCircleUp}
                    fontSize="24px"
                    color="primary.500"
                    onClick={handleSubmit}
                    cursor="pointer"
                  />
                )
              )}
            </Flex>
          </Flex>
        </Box>
      </Box>
    </Box>
  )
}

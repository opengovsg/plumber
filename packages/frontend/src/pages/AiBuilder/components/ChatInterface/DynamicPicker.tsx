import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { FaArrowCircleUp } from 'react-icons/fa'
import { FaCircleStop } from 'react-icons/fa6'
import {
  Box,
  Button,
  Flex,
  Icon,
  Input,
  Spinner,
  Text,
  Textarea,
} from '@chakra-ui/react'

interface DynamicPickerOption {
  name: string
  value: string
}

interface DynamicPickerProps {
  question: string
  stepId: string
  dynamicKey: string
  isStreaming: boolean
  onSelect: (name: string, value: string) => void
  onSkip: () => void
  cancelStream: () => void
}

export default function DynamicPicker({
  question,
  stepId,
  dynamicKey,
  isStreaming,
  onSelect,
  onSkip,
  cancelStream,
}: DynamicPickerProps) {
  const [options, setOptions] = useState<DynamicPickerOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedOption, setSelectedOption] =
    useState<DynamicPickerOption | null>(null)
  const [inputValue, setInputValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    fetch('/api/dynamic-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ stepId, key: dynamicKey }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Fetch failed: ${res.status}`)
        }
        return res.json()
      })
      .then((json) => setOptions(json.data ?? []))
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') {
          setOptions([])
        }
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [stepId, dynamicKey])

  const filtered = query
    ? options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : options

  const hasOptions = !isLoading && options.length > 0

  const handleResize = (e?: FormEvent<HTMLTextAreaElement>) => {
    const target = e?.currentTarget || textareaRef.current
    if (!target) {
      return
    }
    target.style.height = 'auto'
    target.style.height = Math.min(target.scrollHeight, 120) + 'px'
  }

  const handleOptionClick = (opt: DynamicPickerOption) => {
    setSelectedOption(opt)
    setInputValue(opt.name)
  }

  const handleSubmit = () => {
    if (!inputValue.trim() || isStreaming) {
      return
    }
    onSelect(inputValue, selectedOption?.value ?? inputValue)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

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
          {isLoading ? (
            <Flex justify="center" py={4}>
              <Spinner size="sm" color="primary.500" />
            </Flex>
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
          ) : null}
        </Flex>

        <Box borderTop="1px" borderColor="gray.100" mt={4} pt={3}>
          <Flex gap={2} align="flex-end">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                setSelectedOption(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                hasOptions
                  ? 'Or describe your answer…'
                  : 'Enter a value manually…'
              }
              resize="none"
              border="none"
              bg="transparent"
              p={0}
              color="gray.900"
              _placeholder={{ color: 'gray.400' }}
              _focus={{ outline: 'none', boxShadow: 'none' }}
              fontSize="md"
              rows={1}
              maxH="120px"
              overflowY="auto"
              onInput={handleResize}
              isDisabled={isStreaming}
            />
            <Flex align="flex-end" flexShrink={0} h="24px">
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
                inputValue.trim() && (
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

          <Flex justify="flex-end" mt={2}>
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
          </Flex>
        </Box>
      </Box>
    </Box>
  )
}

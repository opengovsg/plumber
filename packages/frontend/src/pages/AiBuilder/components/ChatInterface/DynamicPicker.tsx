import { useEffect, useRef, useState } from 'react'
import { FaCircleStop } from 'react-icons/fa6'
import { Box, Button, Flex, Icon, Input, Spinner, Text } from '@chakra-ui/react'

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
  cancelStream: () => void
}

export default function DynamicPicker({
  question,
  stepId,
  dynamicKey,
  isStreaming,
  onSelect,
  cancelStream,
}: DynamicPickerProps) {
  const [options, setOptions] = useState<DynamicPickerOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
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

        <Input
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          mb={2}
          borderColor="gray.200"
          isDisabled={isLoading}
        />

        <Flex direction="column" gap={2} maxH="240px" overflowY="auto">
          {isLoading ? (
            <Flex justify="center" py={4}>
              <Spinner size="sm" color="primary.500" />
            </Flex>
          ) : filtered.length === 0 ? (
            <Text color="gray.400" fontSize="sm" px={2}>
              {query ? `No results for '${query}'` : 'No options available'}
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
                onClick={() => onSelect(opt.name, opt.value)}
                borderColor="gray.200"
                bg="white"
                color="gray.800"
                _hover={{ borderColor: 'primary.300', bg: 'primary.50' }}
                _active={{ bg: 'primary.100' }}
              >
                <Text textAlign="left" whiteSpace="normal" color="gray.800">
                  {opt.name}
                </Text>
              </Button>
            ))
          )}
        </Flex>

        <Flex justify="flex-end" mt={3} h="24px">
          {isStreaming && (
            <Icon
              as={FaCircleStop}
              fontSize="24px"
              color="red.500"
              cursor="pointer"
              onClick={cancelStream}
              _hover={{ color: 'red.600' }}
            />
          )}
        </Flex>
      </Box>
    </Box>
  )
}

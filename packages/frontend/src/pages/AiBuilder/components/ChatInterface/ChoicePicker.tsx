import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react'
import { FaArrowCircleUp, FaExclamationTriangle } from 'react-icons/fa'
import { FaCircleStop } from 'react-icons/fa6'
import { Box, Button, Flex, Icon, Text, Textarea } from '@chakra-ui/react'
import { Badge } from '@opengovsg/design-system-react'

import { type ClarificationQuestion } from '@/hooks/useChatStream'

interface ChoicePickerProps {
  clarification: ClarificationQuestion[]
  currentQuestionIdx: number
  selectedAnswers: Record<number, string>
  reviewMode: boolean
  isStreaming: boolean
  onOptionClick: (optionIdx: number) => void
  onFreeTextSubmit: (text: string) => void
  onConfirm: () => void
  onReset: () => void
  cancelStream: () => void
}

export default function ChoicePicker({
  clarification,
  currentQuestionIdx,
  selectedAnswers,
  reviewMode,
  isStreaming,
  onOptionClick,
  onFreeTextSubmit,
  onConfirm,
  onReset,
  cancelStream,
}: ChoicePickerProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const currentQ = clarification[currentQuestionIdx] ?? clarification[0]
  const isMulti = clarification.length > 1

  if (reviewMode) {
    const hasWarning = clarification.some((q) => q.isWarning)

    return (
      <Box w="full" maxW="4xl">
        <Box
          bg={hasWarning ? 'red.50' : 'white'}
          border="1px"
          borderColor={hasWarning ? 'red.300' : 'gray.200'}
          borderRadius="16px"
          boxShadow="0 2px 4px rgba(0,0,0,0.1)"
          p={4}
          w="full"
        >
          <Flex direction="column" gap={3}>
            {clarification.map((q, i) => (
              <Box key={i}>
                <Flex align="flex-start" gap={1.5}>
                  {q.isWarning && (
                    <Icon
                      as={FaExclamationTriangle}
                      color="red.500"
                      fontSize="12px"
                      flexShrink={0}
                      mt="2px"
                    />
                  )}
                  <Text fontSize="sm" color="gray.500">
                    {q.question}
                  </Text>
                </Flex>
                <Text
                  fontWeight={q.isWarning ? 'semibold' : 'medium'}
                  color="gray.900"
                  mt={1}
                >
                  {selectedAnswers[i] ?? '—'}
                </Text>
              </Box>
            ))}
          </Flex>

          <Flex
            justify="space-between"
            align="center"
            mt={4}
            pt={3}
            borderTop="1px"
            borderColor="gray.100"
          >
            <Button
              variant="link"
              size="sm"
              color="gray.500"
              onClick={onReset}
              isDisabled={isStreaming}
              fontWeight="normal"
            >
              Change answers
            </Button>
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
              <Icon
                as={FaArrowCircleUp}
                fontSize="24px"
                color="primary.500"
                cursor="pointer"
                onClick={onConfirm}
              />
            )}
          </Flex>
        </Box>
      </Box>
    )
  }

  const handleResize = (e?: FormEvent<HTMLTextAreaElement>) => {
    const target = e?.currentTarget || textareaRef.current
    if (!target) {
      return
    }
    const maxHeight = window.innerHeight * 0.4 - 100
    target.style.height = 'auto'
    target.style.height = Math.min(target.scrollHeight, maxHeight) + 'px'
  }

  const handleSubmit = () => {
    if (!input.trim() || isStreaming) {
      return
    }
    onFreeTextSubmit(input)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const isWarning = currentQ.isWarning

  return (
    <Box w="full" maxW="4xl">
      <Box
        bg={isWarning ? 'red.50' : 'white'}
        border="1px"
        borderColor={isWarning ? 'red.300' : 'gray.200'}
        borderRadius="16px"
        boxShadow="0 2px 4px rgba(0,0,0,0.1)"
        p={4}
        w="full"
      >
        <Flex justify="space-between" align="flex-start" mb={2}>
          <Flex align="flex-start" gap={2}>
            {isWarning && (
              <Icon
                as={FaExclamationTriangle}
                color="red.500"
                fontSize="16px"
                flexShrink={0}
                mt="3px"
              />
            )}
            <Text fontWeight={isWarning ? 'semibold' : 'normal'}>
              {currentQ.question}
            </Text>
          </Flex>
          {isMulti && (
            <Text fontSize="sm" color="gray.400" ml={3} flexShrink={0}>
              {currentQuestionIdx + 1} / {clarification.length}
            </Text>
          )}
        </Flex>

        {currentQ.options.length > 0 && (
          <Flex direction="column" gap={2} maxH="360px" overflowY="auto">
            {currentQ.options.map((opt, optIdx) => (
              <Button
                key={optIdx}
                variant="outline"
                justifyContent="flex-start"
                h="auto"
                py={2}
                isDisabled={isStreaming}
                onClick={() => onOptionClick(optIdx)}
                borderColor={isWarning ? 'red.200' : 'gray.200'}
                bg="white"
                color="gray.800"
                _hover={{
                  borderColor: isWarning ? 'red.400' : 'primary.300',
                  bg: isWarning ? 'red.50' : 'primary.50',
                }}
                _active={{ bg: isWarning ? 'red.100' : 'primary.100' }}
                gap={2}
              >
                <Badge
                  colorScheme={isWarning ? 'critical' : 'secondary'}
                  variant="subtle"
                  size="sm"
                  flexShrink={0}
                >
                  {optIdx + 1}
                </Badge>
                <Text textAlign="left" whiteSpace="normal" color="gray.800">
                  {opt}
                </Text>
              </Button>
            ))}
          </Flex>
        )}

        <Box borderTop="1px" borderColor="gray.100" mt={4} pt={3}>
          <Flex gap={2} align="flex-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={
                currentQ.options.length > 0
                  ? 'Or describe your answer...'
                  : 'Enter your answer...'
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
            <Flex align="flex-end" gap={2} flexShrink={0} h="24px">
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
                input.trim() && (
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

import { Box, Button, Flex, Icon, Text, Textarea } from '@chakra-ui/react'
import { Badge } from '@opengovsg/design-system-react'
import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react'
import { FaArrowCircleUp } from 'react-icons/fa'
import { FaCircleStop } from 'react-icons/fa6'

import { type ClarificationQuestion } from '@/hooks/useChatStream'

interface ChoicePickerProps {
  clarification: ClarificationQuestion[]
  currentQuestionIdx: number
  isStreaming: boolean
  onOptionClick: (optionIdx: number) => void
  onFreeTextSubmit: (text: string) => void
  cancelStream: () => void
}

export default function ChoicePicker({
  clarification,
  currentQuestionIdx,
  isStreaming,
  onOptionClick,
  onFreeTextSubmit,
  cancelStream,
}: ChoicePickerProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const currentQ = clarification[currentQuestionIdx] ?? clarification[0]
  const isMulti = clarification.length > 1

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
        <Flex justify="space-between" align="center" mb={2}>
          <Text>{currentQ.question}</Text>
          {isMulti && (
            <Text fontSize="sm" color="gray.400" ml={3}>
              {currentQuestionIdx + 1} / {clarification.length}
            </Text>
          )}
        </Flex>

        <Flex direction="column" gap={2}>
          {currentQ.options.map((opt, optIdx) => (
            <Button
              key={optIdx}
              variant="outline"
              justifyContent="flex-start"
              h="auto"
              py={2}
              isDisabled={isStreaming}
              onClick={() => onOptionClick(optIdx)}
              borderColor="gray.200"
              bg="white"
              color="gray.800"
              _hover={{ borderColor: 'primary.300', bg: 'primary.50' }}
              _active={{ bg: 'primary.100' }}
              gap={2}
            >
              <Badge
                colorScheme="secondary"
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

        <Box borderTop="1px" borderColor="gray.100" mt={4} pt={3}>
          <Flex gap={2} align="flex-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Or describe your answer..."
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

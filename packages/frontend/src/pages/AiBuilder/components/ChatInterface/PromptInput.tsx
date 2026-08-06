import {
  type FormEvent,
  type KeyboardEvent,
  type SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { FaArrowCircleUp } from 'react-icons/fa'
import { FaCircleStop } from 'react-icons/fa6'
import {
  Box,
  Flex,
  Icon,
  Image,
  Text,
  Textarea,
  Tooltip,
} from '@chakra-ui/react'

import {
  type ClarificationQuestion,
  type DynamicPickerPart,
} from '@/hooks/useChatStream'
import ChoicePicker from '@/pages/AiBuilder/components/ChatInterface/ChoicePicker'
import DynamicPicker from '@/pages/AiBuilder/components/ChatInterface/DynamicPicker'
import IdeaButtons from '@/pages/AiBuilder/components/IdeaButtons'
import { AI_CHAT_IDEAS, type AiChatIdea } from '@/pages/AiBuilder/constants'

interface PromptInputProps {
  isStreaming: boolean
  showIdeas?: boolean
  placeholder?: string
  initialValue?: string
  sendMessage: (message: string) => void
  cancelStream: () => void
  clarification?: ClarificationQuestion[]
  dynamicPicker?: DynamicPickerPart['data']
  onAddConnection?: (context: { question: string }) => void
  /** Form URL already shared in the conversation (drives the picker's forced key-completion card). */
  knownFormUrl?: string
  /** Opens the Add-new-form modal (empty-state "Connect your form" entry). */
  onConnectForm?: () => void
  /**
   * Display-only chip anchoring the conversation's form to the composer —
   * the connected form's title, or the shared URL (isConnected: false)
   * before a secret key has been added.
   */
  attachedForm?: { label: string; isConnected?: boolean } | null
}

// Display-only chip anchoring the conversation's form to the composer.
function FormChip({
  form,
}: {
  form: { label: string; isConnected?: boolean }
}) {
  return (
    <Flex
      align="center"
      gap={1.5}
      bg="gray.50"
      borderRadius="full"
      px={2.5}
      py={1}
      maxW="full"
    >
      <Image
        src="/apps/formsg/assets/favicon.svg"
        boxSize="14px"
        alt="FormSG"
      />
      <Text textStyle="caption-1" noOfLines={1} color="gray.700">
        {form.label}
      </Text>
      {form.isConnected === false && (
        <Text
          textStyle="caption-1"
          color="gray.400"
          flexShrink={0}
          whiteSpace="nowrap"
        >
          · not connected
        </Text>
      )}
    </Flex>
  )
}

export default function PromptInput({
  isStreaming,
  showIdeas = false,
  placeholder = 'Send a message',
  initialValue = '',
  sendMessage,
  cancelStream,
  clarification,
  dynamicPicker,
  onAddConnection,
  knownFormUrl,
  onConnectForm,
  attachedForm,
}: PromptInputProps) {
  const [input, setInput] = useState<string>(initialValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, string>
  >({})
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [reviewMode, setReviewMode] = useState(false)

  // Reset state whenever a new clarification arrives
  useEffect(() => {
    setSelectedAnswers({})
    setCurrentQuestionIdx(0)
    setReviewMode(false)
  }, [clarification])

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault()
    if (input?.trim() && !isStreaming) {
      sendMessage(input)
      setInput('')
      setSelectedAnswers({})
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
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

  // Trigger resize on mount if initialValue is pre-filled
  useEffect(() => {
    if (initialValue) {
      handleResize()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The resize handler above only fires on typed input, but a long
  // placeholder wraps onto multiple lines too — without this, the fixed
  // single-row height overflows and shows a spurious scrollbar. Measure the
  // placeholder's wrapped height the same way (swap it into the DOM value
  // just for the measurement) whenever the box is empty.
  useEffect(() => {
    const el = textareaRef.current
    if (!el || input) {
      return
    }
    const original = el.value
    el.value = placeholder
    handleResize({ currentTarget: el } as FormEvent<HTMLTextAreaElement>)
    el.value = original
  }, [placeholder, input])

  const handleAnswer = (answer: string) => {
    if (isStreaming || !clarification) {
      return
    }

    const newAnswers = { ...selectedAnswers, [currentQuestionIdx]: answer }
    setSelectedAnswers(newAnswers)

    const isLast = currentQuestionIdx === clarification.length - 1
    if (isLast) {
      setReviewMode(true)
    } else {
      setCurrentQuestionIdx((prev) => prev + 1)
    }
  }

  const handleConfirm = () => {
    if (!clarification) {
      return
    }
    const combined = clarification
      .map((q, i) => `Q: ${q.question}\nA: ${selectedAnswers[i]}`)
      .join('\n\n')
    sendMessage(combined)
    setSelectedAnswers({})
    setCurrentQuestionIdx(0)
    setReviewMode(false)
  }

  const handleReset = () => {
    setSelectedAnswers({})
    setCurrentQuestionIdx(0)
    setReviewMode(false)
  }

  const handleOptionClick = (optionIdx: number) => {
    if (!clarification) {
      return
    }
    handleAnswer(clarification[currentQuestionIdx].options[optionIdx])
  }

  // only show idea buttons if showIdeas is true and the user has not entered any text
  const shouldShowIdeas = showIdeas && !input?.trim()

  if (dynamicPicker) {
    const isAppKeyMode = 'appKey' in dynamicPicker
    return (
      <DynamicPicker
        question={dynamicPicker.question}
        {...(isAppKeyMode
          ? { appKey: dynamicPicker.appKey }
          : { stepId: dynamicPicker.stepId, dynamicKey: dynamicPicker.key })}
        isStreaming={isStreaming}
        onSelect={(name, value) => {
          sendMessage(`Q: ${dynamicPicker.question}\nA: ${name} (id: ${value})`)
        }}
        onSkip={() => {
          sendMessage(`Q: ${dynamicPicker.question}\nA: skip`)
        }}
        onAddConnection={
          onAddConnection && isAppKeyMode
            ? () => onAddConnection({ question: dynamicPicker.question })
            : undefined
        }
        knownFormUrl={knownFormUrl}
        cancelStream={cancelStream}
      />
    )
  }

  if (clarification && clarification.length > 0) {
    return (
      <ChoicePicker
        clarification={clarification}
        currentQuestionIdx={currentQuestionIdx}
        selectedAnswers={selectedAnswers}
        reviewMode={reviewMode}
        isStreaming={isStreaming}
        onOptionClick={handleOptionClick}
        onFreeTextSubmit={handleAnswer}
        onConfirm={handleConfirm}
        onReset={handleReset}
        cancelStream={cancelStream}
      />
    )
  }

  const showChipsRow = Boolean(onConnectForm || attachedForm)

  return (
    <Box w="full" maxW="4xl">
      <Flex
        direction="column"
        bg="white"
        border="1px"
        borderColor="gray.200"
        borderRadius="16px"
        boxShadow="0 2px 4px rgba(0, 0, 0, 0.1)"
        p={2}
        w="full"
        minH={showIdeas ? '120px' : '50px'}
        height="auto"
      >
        <Flex direction="row" align="stretch" flex={1}>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
            w="full"
            resize="none"
            border="none"
            bg="transparent"
            p={3}
            color="gray.900"
            _placeholder={{ color: 'gray.500' }}
            _focus={{ outline: 'none', boxShadow: 'none' }}
            fontSize="base"
            lineHeight="6"
            maxH="calc(40vh - 100px)"
            rows={1}
            overflowY="auto"
            sx={{
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
              },
            }}
            onInput={handleResize}
            onFocus={(e) => {
              // prevent iOS Safari from zooming in on input focus
              e.currentTarget.style.fontSize = '16px'
            }}
          />

          <Flex justify="end" align="flex-end" p={3}>
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
                color={
                  input?.trim()
                    ? 'primary.500'
                    : 'interaction.support.disabled-content'
                }
                onClick={handleSubmit}
                cursor={input?.trim() ? 'pointer' : 'default'}
              />
            )}
          </Flex>
        </Flex>

        {showChipsRow && (
          <Flex px={2} pb={1} pt={1} align="center" gap={2}>
            {attachedForm?.isConnected ? (
              <FormChip form={attachedForm} />
            ) : onConnectForm ? (
              <Tooltip
                label="Most workflows start with a FormSG form. Connect yours and I'll guide you based on its actual fields."
                hasArrow
                placement="top-start"
              >
                <Flex display="inline-flex">
                  <Box
                    as="button"
                    type="button"
                    display="inline-flex"
                    alignItems="center"
                    gap={1.5}
                    border="1px"
                    borderColor="gray.200"
                    borderRadius="full"
                    color="gray.700"
                    fontWeight="medium"
                    fontSize="xs"
                    px={2.5}
                    py={1}
                    opacity={isStreaming ? 0.5 : 1}
                    cursor={isStreaming ? 'not-allowed' : 'pointer'}
                    onClick={isStreaming ? undefined : onConnectForm}
                  >
                    <Image
                      src="/apps/formsg/assets/favicon.svg"
                      boxSize="14px"
                      alt=""
                    />
                    Connect your form
                  </Box>
                </Flex>
              </Tooltip>
            ) : attachedForm ? (
              // Dead-end fallback: a URL is known but not connected, and
              // there's no trigger left to retry through (e.g. post-pipe,
              // before the LLM's connection picker has fired).
              <FormChip form={attachedForm} />
            ) : null}
          </Flex>
        )}
      </Flex>

      {showIdeas && (
        <Box minH={{ base: '200px', md: '60px' }} mt={6}>
          {shouldShowIdeas && (
            <IdeaButtons
              ideas={AI_CHAT_IDEAS}
              onClick={(idea: AiChatIdea) => {
                setInput(idea.input)
                // trigger resize after state update
                setTimeout(() => handleResize(), 0)
              }}
            />
          )}
        </Box>
      )}
    </Box>
  )
}

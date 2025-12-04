import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Form } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  ModalHeader,
  Spinner,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormLabel, useIsMobile } from '@opengovsg/design-system-react'
import { debounce } from 'lodash'

import pairLogo from '@/assets/pair-logo.svg'
import { ImageBox } from '@/components/FlowStepConfigurationModal/ChooseAndAddConnection/ConfigureExcelConnection'
import { REFINE_FORM_INPUT } from '@/graphql/mutations/ai/refine-form-input'
import { AI_FORM_SCHEMA, AiFormData } from '@/pages/AiBuilder/schema'
import { AI_FORM_IDEAS, AiFormIdea } from '@/pages/Flows/constants'

import IdeaButtons from './IdeaButtons'

const AI_FORM_FIELDS = [
  {
    key: 'actions' as const,
    label: 'What should this workflow accomplish?',
    placeholder:
      'This workflow should help me to collect attendance for my event.',
    required: true,
    resize: 'vertical' as const,
    minH: '100px',
    maxH: '200px',
  },
  {
    key: 'trigger' as const,
    label: 'Where does your data come from?',
    placeholder: 'FormSG',
    required: true,
    resize: 'vertical' as const,
    minH: '42px',
    maxH: '126px',
  },
]

export const AIFormModalContent = ({
  flowName,
  trigger,
  actions,
  type,
  onBack,
  onSubmit,
}: {
  flowName?: string
  trigger?: string
  actions?: string
  type: 'create' | 'update'
  onBack: () => void
  onSubmit: (data: AiFormData) => void
}) => {
  const [refineFormInput, { loading: isRefiningFormInput }] =
    useMutation(REFINE_FORM_INPUT)

  const isMobile = useIsMobile()
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch,
  } = useForm<AiFormData>({
    resolver: zodResolver(AI_FORM_SCHEMA),
    mode: 'onChange',
    defaultValues: {
      flowName: flowName || 'Name your Pipe',
      trigger: trigger || undefined,
      actions: actions || undefined,
    },
  })

  const actionsValue = watch('actions')
  const isFromSuggestionRef = useRef(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [showReadyMessage, setShowReadyMessage] = useState(false)

  const callRefineFormInput = useCallback(
    async (prompt: string) => {
      // Skip if the value is from a suggestion
      if (isFromSuggestionRef.current) {
        isFromSuggestionRef.current = false
        return
      }

      // Skip if trigger is empty or too short (minimum 15 characters required by API)
      if (!prompt || prompt.trim().length < 15) {
        setAiSuggestion(null)
        setShowReadyMessage(false)
        return
      }

      try {
        const result = await refineFormInput({
          variables: {
            input: {
              prompt,
              sessionId: null,
            },
          },
        })

        if (result.data?.refineFormInput) {
          const { status, suggestion } = result.data.refineFormInput
          if (status) {
            // Status is true - show ready message
            setShowReadyMessage(true)
            setAiSuggestion(null)
          } else if (suggestion) {
            // Status is false and we have a suggestion
            setAiSuggestion(suggestion)
            setShowReadyMessage(false)
          } else {
            setAiSuggestion(null)
            setShowReadyMessage(false)
          }
        }
      } catch (error) {
        console.error('Error refining form input:', error)
        setAiSuggestion(null)
        setShowReadyMessage(false)
      }
    },
    [refineFormInput],
  )

  const debouncedRefineFormInput = useMemo(
    () => debounce(callRefineFormInput, 2000),
    [callRefineFormInput],
  )

  const handleIdeaClick = (idea: AiFormIdea) => {
    isFromSuggestionRef.current = true
    debouncedRefineFormInput.cancel()
    setAiSuggestion(null)
    setShowReadyMessage(false)
    setValue('trigger', idea.trigger, { shouldValidate: true })
    setValue('actions', idea.actions, { shouldValidate: true })
  }

  useEffect(() => {
    debouncedRefineFormInput(actionsValue)
  }, [actionsValue, debouncedRefineFormInput])

  const isCreate = type === 'create'
  const shouldShowIdeaButtons =
    isCreate && !isRefiningFormInput && !aiSuggestion && !showReadyMessage

  return (
    <>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <ModalHeader p="2.5rem 2rem 1.5rem">
          <Text textStyle="h4">Build with AI</Text>
        </ModalHeader>
        {!isCreate && <ModalCloseButton onClick={onBack} />}
        <ModalBody>
          <Flex gap={4} flexDir="column">
            {AI_FORM_FIELDS.map((field) => (
              <FormControl
                isRequired
                isInvalid={!!errors[field.key]}
                key={field.key}
              >
                <Flex gap={2} flexDir="column">
                  <FormLabel>{field.label}</FormLabel>
                  <Textarea
                    {...register(field.key)}
                    placeholder={field.placeholder}
                    resize={field.resize}
                    minH={field.minH}
                    maxH={field.maxH}
                    required={field.required}
                  />
                  {errors[field.key] && (
                    <FormErrorMessage>
                      {errors[field.key]?.message}
                    </FormErrorMessage>
                  )}
                  {field.key === 'actions' &&
                    (isRefiningFormInput ||
                      aiSuggestion ||
                      showReadyMessage) && (
                      <Box mt={2} borderRadius="md">
                        {isRefiningFormInput ? (
                          <Flex align="center" gap={2}>
                            <Spinner size="sm" />
                            <Text fontSize="sm">Loading suggestion...</Text>
                          </Flex>
                        ) : showReadyMessage ? (
                          <Text fontSize="sm" color="green.600">
                            <Text as="span" fontWeight="semibold">
                              All good!
                            </Text>{' '}
                            Let&apos;s give it a try.
                          </Text>
                        ) : (
                          <Text fontSize="sm">
                            <Text as="span" fontWeight="semibold">
                              Suggestion:
                            </Text>{' '}
                            {aiSuggestion}
                          </Text>
                        )}
                      </Box>
                    )}
                  {field.key === 'actions' && shouldShowIdeaButtons && (
                    <IdeaButtons
                      ideas={AI_FORM_IDEAS}
                      onClick={handleIdeaClick}
                    />
                  )}
                </Flex>
              </FormControl>
            ))}
          </Flex>
        </ModalBody>
        <ModalFooter>
          <Flex
            justifyContent={isMobile ? 'flex-end' : 'space-between'}
            alignItems="center"
            w="100%"
          >
            {!isMobile && (
              <Flex gap={1} alignItems="center" justifyContent="center">
                <Text fontSize="xs" color="gray.500">
                  Powered by{' '}
                </Text>
                <ImageBox imageUrl={pairLogo} boxSize={6} />
              </Flex>
            )}
            <Flex gap={4}>
              {isCreate && (
                <Button
                  variant="clear"
                  colorScheme="secondary"
                  onClick={onBack}
                >
                  Back
                </Button>
              )}
              <Button type="submit" isDisabled={!isValid}>
                {isCreate ? 'Create' : 'Update'}
              </Button>
            </Flex>
          </Flex>
        </ModalFooter>
      </Form>
    </>
  )
}

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Form } from 'react-router-dom'
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

import pairLogo from '@/assets/pair-logo.svg'
import { ImageBox } from '@/components/FlowStepConfigurationModal/ChooseAndAddConnection/ConfigureExcelConnection'
import { AI_FORM_SCHEMA, AiFormData } from '@/pages/AiBuilder/schema'
import { AI_FORM_IDEAS, AiFormIdea } from '@/pages/Flows/constants'

import { useRefineFormInput } from '../hooks/useRefineFormInput'

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

  const triggerValue = watch('trigger')
  const actionsValue = watch('actions')

  const {
    refineFormInput,
    isRefiningFormInput,
    aiSuggestion,
    showReadyMessage,
    resetSuggestion,
  } = useRefineFormInput()

  const handleIdeaClick = (idea: AiFormIdea) => {
    resetSuggestion()
    setValue('trigger', idea.trigger, { shouldValidate: true })
    setValue('actions', idea.actions, { shouldValidate: true })
  }

  useEffect(() => {
    if (triggerValue?.trim() && actionsValue?.trim()) {
      refineFormInput(triggerValue, actionsValue)
    }
  }, [triggerValue, actionsValue, refineFormInput])

  const isCreate = type === 'create'
  const shouldShowIdeaButtons =
    isCreate && !isRefiningFormInput && !aiSuggestion && !showReadyMessage
  const shouldShowSuggestion =
    isRefiningFormInput || aiSuggestion || showReadyMessage

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
              </FormControl>
            ))}
            {shouldShowSuggestion && (
              <Box borderRadius="md">
                {isRefiningFormInput ? (
                  <Flex align="center" gap={2}>
                    <Spinner size="sm" />
                  </Flex>
                ) : showReadyMessage ? (
                  <Text fontSize="sm" color="green.600">
                    <Text as="span" fontWeight="semibold">
                      All good!
                    </Text>{' '}
                    Let&apos;s give it a try.
                  </Text>
                ) : (
                  <Text>
                    <Text as="span" fontWeight="medium">
                      Consider addressing:{' '}
                    </Text>
                    <Text as="span" fontWeight="regular">
                      {aiSuggestion}
                    </Text>
                  </Text>
                )}
              </Box>
            )}

            {shouldShowIdeaButtons && (
              <IdeaButtons ideas={AI_FORM_IDEAS} onClick={handleIdeaClick} />
            )}
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

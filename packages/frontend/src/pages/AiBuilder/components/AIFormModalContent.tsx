import { useForm } from 'react-hook-form'
import { Form } from 'react-router-dom'
import {
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormLabel, useIsMobile } from '@opengovsg/design-system-react'

import pairLogo from '@/assets/pair-logo.svg'
import { ImageBox } from '@/components/FlowStepConfigurationModal/ChooseAndAddConnection/ConfigureExcelConnection'
import { AI_FORM_SCHEMA, AiFormData } from '@/pages/AiBuilder/schema'
import { AI_FORM_FIELDS, AI_FORM_IDEAS } from '@/pages/Flows/constants'

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
  } = useForm<AiFormData>({
    resolver: zodResolver(AI_FORM_SCHEMA),
    mode: 'onChange',
    defaultValues: {
      flowName: flowName || 'Name your Pipe',
      trigger: trigger || undefined,
      actions: actions || undefined,
    },
  })

  const handleIdeaClick = (idea: (typeof AI_FORM_IDEAS)[number]) => {
    setValue('trigger', idea.trigger, { shouldValidate: true })
    setValue('actions', idea.actions, { shouldValidate: true })
  }

  return (
    <>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <ModalHeader p="2.5rem 2rem 1.5rem">
          <Text textStyle="h4">Build with AI</Text>
        </ModalHeader>
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
            <Flex flexDir="row" alignItems="center">
              <FormLabel
                isRequired
                style={{ margin: 0, marginRight: '0.5rem' }}
              >
                {/* arbitrary isRequired to hide optional text */}
                Try:
              </FormLabel>
              <Flex
                flexDir="row"
                gap={2}
                justifyContent="space-between"
                flexWrap="wrap"
              >
                {AI_FORM_IDEAS.map((idea) => (
                  <Button
                    key={idea.label}
                    size="sm"
                    bgColor="interaction.sub-subtle.default"
                    color="#5D6785"
                    variant="clear"
                    _hover={{
                      bgColor: 'interaction.sub-subtle.hover',
                    }}
                    onClick={() => handleIdeaClick(idea)}
                    px={3}
                    minH={4}
                    w={isMobile ? 'calc(50% - 4px)' : 'auto'}
                    flexShrink={0}
                  >
                    <Text textStyle="caption-1">{idea.label}</Text>
                  </Button>
                ))}
              </Flex>
            </Flex>
          </Flex>
        </ModalBody>
        <ModalFooter>
          <Flex justifyContent="space-between" alignItems="center" w="100%">
            <Flex gap={1} alignItems="center">
              <Text fontSize="xs" color="gray.500">
                Powered by{' '}
              </Text>
              <ImageBox imageUrl={pairLogo} boxSize={6} />
            </Flex>
            <Flex gap={4}>
              <Button variant="clear" colorScheme="secondary" onClick={onBack}>
                Back
              </Button>
              <Button type="submit" isDisabled={!isValid}>
                {type === 'update' ? 'Update workflow' : 'Create'}
              </Button>
            </Flex>
          </Flex>
        </ModalFooter>
      </Form>
    </>
  )
}

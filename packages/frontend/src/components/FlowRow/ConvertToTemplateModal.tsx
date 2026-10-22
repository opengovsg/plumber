import type { IFlow } from '@plumber/types'

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useMutation } from '@apollo/client'
import {
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Textarea,
} from '@chakra-ui/react'
import { Button, Infobox, useToast } from '@opengovsg/design-system-react'
import { z } from 'zod'

import { CREATE_TEMPLATE_FROM_FLOW } from '@/graphql/mutations/create-template-from-flow'

const responseSchema = z.object({
  description: z.string().trim().min(1).max(2000),
})

interface ConvertToTemplateModalProps {
  flow: Pick<IFlow, 'id' | 'name'>
  onClose: () => void
}

export default function ConvertToTemplateModal({
  flow,
  onClose,
}: ConvertToTemplateModalProps) {
  const [title, setTitle] = useState(flow.name)
  const [description, setDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(true)
  const [generationFailed, setGenerationFailed] = useState(false)
  const descriptionEdited = useRef(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const [createTemplate, { loading: isSaving }] = useMutation(
    CREATE_TEMPLATE_FROM_FLOW,
  )

  useEffect(() => {
    const controller = new AbortController()
    async function generate() {
      try {
        const response = await fetch('/api/template-description', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flowId: flow.id }),
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('Description generation failed')
        }
        const result = responseSchema.parse(await response.json())
        if (!controller.signal.aborted && !descriptionEdited.current) {
          setDescription(result.description)
        }
      } catch {
        if (!controller.signal.aborted) {
          setGenerationFailed(true)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsGenerating(false)
        }
      }
    }
    void generate()
    return () => controller.abort()
  }, [flow.id])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || isGenerating || isSaving) {
      return
    }
    try {
      await createTemplate({
        variables: {
          input: {
            flowId: flow.id,
            name: title.trim(),
            description: description.trim(),
          },
        },
        update: (cache) => {
          cache.evict({ fieldName: 'getTemplates' })
        },
      })
      toast({
        title: 'The pipe has been saved as a template.',
        status: 'success',
      })
      onClose()
    } catch {
      toast({
        title: 'Unable to convert the pipe to a template.',
        status: 'error',
      })
    }
  }

  return (
    <Modal
      isOpen
      onClose={isSaving ? () => {} : onClose}
      initialFocusRef={titleRef}
      isCentered
      closeOnOverlayClick={!isSaving}
      closeOnEsc={!isSaving}
    >
      <ModalOverlay bg="base.canvas.overlay" />
      <ModalContent as="form" onSubmit={handleSubmit}>
        <ModalHeader>Convert to template</ModalHeader>
        <ModalCloseButton isDisabled={isSaving} />
        <ModalBody>
          <Stack spacing={6}>
            <FormControl isRequired isDisabled={isSaving}>
              <FormLabel htmlFor="template-title">Title</FormLabel>
              <Input
                id="template-title"
                ref={titleRef}
                value={title}
                maxLength={255}
                onChange={(event) => setTitle(event.target.value)}
              />
            </FormControl>
            <FormControl isDisabled={isSaving}>
              <FormLabel htmlFor="template-description">Description</FormLabel>
              <Textarea
                id="template-description"
                value={description}
                maxLength={2000}
                rows={5}
                onChange={(event) => {
                  descriptionEdited.current = true
                  setDescription(event.target.value)
                }}
              />
              <FormHelperText aria-live="polite">
                {isGenerating
                  ? 'Generating a description from the pipe steps…'
                  : 'Review and edit the description before saving.'}
              </FormHelperText>
            </FormControl>
            {generationFailed && (
              <Infobox variant="warning">
                We could not generate a description. You can enter one manually.
              </Infobox>
            )}
          </Stack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button
            colorScheme="secondary"
            onClick={onClose}
            isDisabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isSaving}
            isDisabled={!title.trim() || isGenerating}
          >
            Save template
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

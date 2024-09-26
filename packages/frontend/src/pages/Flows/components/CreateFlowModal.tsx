import { FormEvent, useCallback, useRef, useState } from 'react'
import { BiBulb } from 'react-icons/bi'
import { Form, useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  Flex,
  FormControl,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react'
import {
  Button,
  FormLabel,
  Infobox,
  Input,
} from '@opengovsg/design-system-react'

import MarkdownRenderer from '@/components/MarkdownRenderer'
import { infoboxMdComponents } from '@/components/MarkdownRenderer/CustomMarkdownComponents'
import * as URLS from '@/config/urls'
import { CREATE_FLOW } from '@/graphql/mutations/create-flow'

interface CreateFlowModalProps {
  onClose: () => void
}

export default function CreateFlowModal(props: CreateFlowModalProps) {
  const { onClose } = props
  const navigate = useNavigate()
  const [createFlow, { loading }] = useMutation(CREATE_FLOW)
  const [isButtonDisabled, setIsButtonDisabled] = useState<boolean>(true)
  const inputRef = useRef<HTMLInputElement>(null)

  // to minimise the re-renders to the max, didn't use react hook form cus overkill
  const handleInputChange = () => {
    const trimmedInputValue = inputRef.current?.value.trim() || ''
    if (trimmedInputValue !== '') {
      if (isButtonDisabled) {
        setIsButtonDisabled(false)
      }
    } else {
      if (!isButtonDisabled) {
        setIsButtonDisabled(true)
      }
    }
  }

  const onCreateFlow = useCallback(
    async (flowName: string) => {
      const response = await createFlow({
        variables: {
          input: {
            flowName,
          },
        },
      })
      navigate(URLS.FLOW_EDITOR(response.data?.createFlow?.id), {
        replace: true,
      })
    },
    [createFlow, navigate],
  )

  const handleSubmit = (_event: FormEvent<HTMLFormElement>) => {
    const trimmedFlowName = inputRef.current?.value.trim()
    if (trimmedFlowName) {
      onCreateFlow(trimmedFlowName)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      motionPreset="none"
      closeOnEsc={false}
      isCentered
    >
      <ModalOverlay bg="base.canvas.overlay" />
      <Form onSubmit={handleSubmit}>
        <ModalContent>
          <ModalHeader p="2.5rem 2rem 1.5rem">
            <Text textStyle="h4">Create Pipe</Text>
          </ModalHeader>

          <ModalBody>
            <Flex flexDir="column" rowGap={4}>
              {/* Specific form items */}
              <Flex flexDir="column">
                <FormControl isRequired>
                  <FormLabel textStyle="subhead-1">Name your pipe</FormLabel>
                  <Input
                    ref={inputRef}
                    placeholder="For e.g. track event feedback, send customised replies"
                    onChange={handleInputChange}
                    required
                  />
                </FormControl>
              </Flex>

              <Infobox icon={<BiBulb />} variant="primary">
                <MarkdownRenderer
                  source="Need suggestions on what to automate? [See use cases](/templates)"
                  components={infoboxMdComponents}
                />
              </Infobox>
            </Flex>
          </ModalBody>
          <ModalCloseButton mt={3} />

          <ModalFooter>
            <Button
              type="submit"
              isDisabled={isButtonDisabled}
              isLoading={loading}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Form>
    </Modal>
  )
}

import { useCallback, useState } from 'react'
import { BiBulb } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  chakra,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react'
import { Button, Infobox, Input, Link } from '@opengovsg/design-system-react'

import MarkdownRenderer from '@/components/MarkdownRenderer'
import * as URLS from '@/config/urls'
import { CREATE_FLOW } from '@/graphql/mutations/create-flow'

interface CreateFlowModalProps {
  onClose: () => void
}

export default function CreateFlowModal(props: CreateFlowModalProps) {
  const { onClose } = props
  const [flowName, setFlowName] = useState('')
  const navigate = useNavigate()
  const [createFlow, { loading }] = useMutation(CREATE_FLOW)

  const onCreateFlow = useCallback(async () => {
    const response = await createFlow({
      variables: {
        input: {
          flowName,
        },
      },
    })
    navigate(URLS.FLOW_EDITOR(response.data?.createFlow?.id), { replace: true })
  }, [createFlow, flowName, navigate])

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      motionPreset="none"
      closeOnEsc={false}
      isCentered
    >
      <ModalOverlay bg="base.canvas.overlay" />
      <ModalContent>
        <ModalHeader p="2.5rem 2rem 1.5rem">
          <Text textStyle="h4">Create Pipe</Text>
        </ModalHeader>

        <ModalBody>
          <Flex flexDir="column" rowGap={4}>
            <Flex flexDir="column" rowGap={2}>
              <Text textStyle="subhead-1">Name your pipe</Text>
              <Input
                placeholder="For e.g. track event feedback, send customised replies"
                value={flowName}
                onChange={(event) => setFlowName(event.target.value)}
              />
            </Flex>
            <Infobox icon={<BiBulb />} variant="primary">
              <MarkdownRenderer
                source="Need suggestions on what to automate? [See use cases](https://guide.plumber.gov.sg/popular-workflows/all-workflows)"
                components={{
                  a: ({ ...props }) => (
                    <Link
                      isExternal
                      color="interaction.links.neutral-default"
                      _hover={{ color: 'interaction.links.neutral-hover' }}
                      {...props}
                    />
                  ),
                  p: ({ ...props }) => <chakra.p {...props} />,
                }}
              />
            </Infobox>
          </Flex>
        </ModalBody>
        <ModalCloseButton mt={3} />

        <ModalFooter>
          <Button
            isDisabled={flowName === ''}
            isLoading={loading}
            onClick={onCreateFlow}
          >
            Create
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { BiBulb } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  Flex,
  Image,
  Modal,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  Text,
} from '@chakra-ui/react'
import { Badge, BadgeLeftIcon, Button } from '@opengovsg/design-system-react'
import demoModalImg from 'assets/demo-modal.png'
import * as URLS from 'config/urls'
import { CREATE_FLOW_TEMPLATE } from 'graphql/mutations/create-flow-template'
import {
  FLOW_TEMPLATES_MAP,
  FORMSG_POSTMAN_TEMPLATE,
} from 'helpers/flow-templates'

interface DemoPageModalProps {
  onClose: () => void
}

// only 1 default template and demo video to display for GGWP v1
const { flowName, trigger, actions, demoVideoId } =
  FLOW_TEMPLATES_MAP[FORMSG_POSTMAN_TEMPLATE]

export default function DemoPageModal(props: DemoPageModalProps) {
  const { onClose } = props
  const navigate = useNavigate()
  const [flowId, setFlowId] = useState('')

  const [createFlowTemplate, { loading }] = useMutation(CREATE_FLOW_TEMPLATE)
  const onCreateFlowTemplate = useCallback(async () => {
    const response = await createFlowTemplate({
      variables: {
        input: {
          flowName,
          trigger,
          actions,
          demoVideoId,
        },
      },
    })
    setFlowId(response.data?.createFlowTemplate?.id)
  }, [createFlowTemplate])

  useEffect(() => {
    if (flowId) {
      navigate(URLS.FLOW(flowId))
    }
  }, [navigate, flowId])

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="3xl"
      motionPreset="none"
      closeOnEsc={false}
    >
      <ModalOverlay bg="base.canvas.overlay" />
      <ModalContent my={12} p={4}>
        <Flex flexDir="column" gap={8} p={8}>
          <Image src={demoModalImg} alt="demo-modal-illustration" />

          <Flex flexDir="column" gap={4}>
            <Badge variant="subtle" color="primary.600">
              <BadgeLeftIcon as={BiBulb} />
              Demo
            </Badge>
            <Text textStyle="h3-semibold">Send notifications</Text>
            <Text textStyle="body-1">
              This demo shows you how to send out a customised email
              notification with each new form response. Common use cases include
              notifications, or acknowledgments and follow up instructions.
            </Text>
          </Flex>

          <ModalFooter p={0} gap={4}>
            <Button onClick={onClose} variant="clear" color="primary.600">
              Try demo later
            </Button>
            <Button onClick={onCreateFlowTemplate} isLoading={loading}>
              Start demo
            </Button>
          </ModalFooter>
        </Flex>
      </ModalContent>
    </Modal>
  )
}

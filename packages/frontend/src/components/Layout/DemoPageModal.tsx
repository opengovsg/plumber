import { useCallback } from 'react'
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

import demoModalImg from '@/assets/demo-modal.png'
import * as URLS from '@/config/urls'
import { CREATE_TEMPLATED_FLOW } from '@/graphql/mutations/create-templated-flow'
import { SEND_NOTIFICATIONS_DEMO_TEMPLATE_ID } from '@/helpers/flow-templates'

// TODO (mal): remove this after combining demos and templates
interface DemoPageModalProps {
  onClose: () => void
}

export default function DemoPageModal(props: DemoPageModalProps) {
  const { onClose } = props
  const navigate = useNavigate()

  const [createTemplatedFlow, { loading }] = useMutation(CREATE_TEMPLATED_FLOW)
  const onCreateTemplatedFlow = useCallback(async () => {
    const response = await createTemplatedFlow({
      variables: {
        input: {
          templateId: SEND_NOTIFICATIONS_DEMO_TEMPLATE_ID, // only 1 default template and demo video to display for GGWP v1
        },
      },
    })
    navigate(URLS.FLOW(response.data?.createTemplatedFlow?.id))
  }, [createTemplatedFlow, navigate])

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="3xl"
      motionPreset="none"
      closeOnEsc={false}
      isCentered
    >
      <ModalOverlay bg="base.canvas.overlay" />
      <ModalContent p={8} borderRadius={8}>
        <Flex flexDir="column" gap={8}>
          <Image src={demoModalImg} alt="demo-modal-illustration" />

          <Flex flexDir="column" gap={4}>
            <Badge variant="subtle">
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
            <Button onClick={onClose} variant="clear">
              Try demo later
            </Button>
            <Button onClick={onCreateTemplatedFlow} isLoading={loading}>
              Start demo
            </Button>
          </ModalFooter>
        </Flex>
      </ModalContent>
    </Modal>
  )
}

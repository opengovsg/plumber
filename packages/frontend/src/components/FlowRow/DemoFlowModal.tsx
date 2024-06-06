import { ReactElement, useState } from 'react'
import { BiBulb } from 'react-icons/bi'
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
import {
  DEMO_VIDEOS_MAP,
  FORMSG_POSTMAN_TEMPLATE,
} from 'helpers/flow-templates'

import DemoVideoModalContent from './DemoVideoModalContent'

interface DemoFlowModalProps {
  onClose: () => void
  isPreCreated?: boolean
  demoVideoId?: string
}

export default function DemoFlowModal(props: DemoFlowModalProps): ReactElement {
  const { onClose, isPreCreated, demoVideoId } = props
  // fallback to default demo video to display for GGWP v1
  const { url, title } = demoVideoId
    ? DEMO_VIDEOS_MAP[demoVideoId]
    : DEMO_VIDEOS_MAP[FORMSG_POSTMAN_TEMPLATE]

  const [showVideoModal, setShowVideoModal] = useState(false)

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size={showVideoModal ? '5xl' : '3xl'}
      motionPreset="none"
      closeOnEsc={false}
    >
      <ModalOverlay bg="base.canvas.overlay" />
      <ModalContent my={12} p={4}>
        {/* Demo created by user should immediately load demo video */}
        {!isPreCreated || showVideoModal ? (
          <DemoVideoModalContent src={url} title={title} />
        ) : (
          <Flex flexDir="column" gap={8} p={8}>
            <Image src={demoModalImg} alt="demo-modal-illustration" />

            <Flex flexDir="column" gap={4}>
              <Badge variant="subtle" color="primary.600">
                <BadgeLeftIcon as={BiBulb} />
                Demo
              </Badge>
              <Text textStyle="h3-semibold">Send notifications</Text>
              <Text textStyle="body-1">
                You will learn how to set up a workflow that will send out a
                customised email notification to a respondent whenever they
                submit your form. Common use cases include sending
                acknowledgments or providing follow up instructions to form
                respondents.
              </Text>
            </Flex>

            <ModalFooter p={0} gap={4}>
              <Button onClick={onClose} variant="clear" color="primary.600">
                Skip demo and build now
              </Button>
              <Button onClick={() => setShowVideoModal(true)}>
                Start demo
              </Button>
            </ModalFooter>
          </Flex>
        )}
      </ModalContent>
    </Modal>
  )
}

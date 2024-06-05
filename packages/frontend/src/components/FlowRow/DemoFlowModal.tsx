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

import DemoVideoModalContent from './DemoVideoModalContent'

interface DemoFlowModalProps {
  onClose: () => void
}

export default function DemoFlowModal(props: DemoFlowModalProps): ReactElement {
  const { onClose } = props
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
      <ModalContent my={12}>
        {showVideoModal ? (
          // TODO (mal): to update this when there are more demo links in the future
          <DemoVideoModalContent
            src="https://demo.arcade.software/FzpL1zCmibw0oXR6HUJi?embed&show_copy_link=true"
            title={`Forms -&gt; Postman (GGWP)`}
          />
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
                This demo shows you how to send out a customised email
                notification with each new form response. Common use cases
                include notifications, or acknowledgments and follow up
                instructions.
              </Text>
            </Flex>

            <ModalFooter p={0} gap={4}>
              <Button onClick={onClose} variant="clear" color="primary.600">
                Build your own workflow
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

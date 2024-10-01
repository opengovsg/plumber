import { ReactElement } from 'react'
import { Modal, ModalContent, ModalOverlay } from '@chakra-ui/react'

import {
  DEMO_VIDEOS_MAP,
  SEND_FOLLOW_UPS_DEMO_VIDEO_ID,
} from '@/helpers/flow-templates'

import DemoVideoModalContent from './DemoVideoModalContent'

interface DemoFlowModalProps {
  onClose: () => void
  demoVideoId?: string
}

export default function DemoFlowModal(props: DemoFlowModalProps): ReactElement {
  const { onClose, demoVideoId } = props
  // fallback to default demo video to display for GGWP v1
  const { url, title } =
    DEMO_VIDEOS_MAP[demoVideoId ?? SEND_FOLLOW_UPS_DEMO_VIDEO_ID]

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="5xl"
      motionPreset="none"
      closeOnEsc={false}
      isCentered
    >
      <ModalOverlay bg="base.canvas.overlay" />
      <ModalContent p={4} borderRadius="lg">
        <DemoVideoModalContent src={url} title={title} />
      </ModalContent>
    </Modal>
  )
}

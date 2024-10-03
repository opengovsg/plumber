import { DemoVideoDetails } from '@plumber/types'

import { ReactElement } from 'react'
import { Modal, ModalContent, ModalOverlay } from '@chakra-ui/react'

import DemoVideoModalContent from './DemoVideoModalContent'

interface DemoFlowModalProps {
  onClose: () => void
  demoVideoDetails?: DemoVideoDetails
}

export default function DemoFlowModal(props: DemoFlowModalProps): ReactElement {
  const { onClose, demoVideoDetails } = props
  // fallback to default demo video to display for GGWP v1
  const { url, title } = demoVideoDetails ?? {}

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

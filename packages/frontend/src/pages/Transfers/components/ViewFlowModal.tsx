import { useNavigate } from 'react-router-dom'
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import * as URLS from '../../../config/urls'

interface ViewFlowModalProps {
  onClose: () => void
  flowId: string
}

export default function ViewFlowModal(props: ViewFlowModalProps) {
  const { onClose, flowId } = props
  const navigate = useNavigate()
  return (
    <Modal isOpen={true} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Pipe has been successfully transferred!</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text>
            You will need to manually add the connections to your pipe for it to
            work.
          </Text>
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => navigate(URLS.FLOW_EDITOR(flowId))}>
            View Pipe
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

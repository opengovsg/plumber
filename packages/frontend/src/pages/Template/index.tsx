import { Modal, ModalContent, ModalOverlay } from '@chakra-ui/react'
import type { IApp, ITemplate } from '@plumber/types'
import { useNavigate } from 'react-router-dom'

import * as URLS from '@/config/urls'

import TemplatePreview from './components/TemplatePreview'
import { TEMPLATE_MODAL_HEIGHT } from './constants'

interface TemplateProps {
  template: ITemplate
  apps: IApp[]
}

// The template page is a modal and the route is /templates/:templateId
export default function TemplateModal(props: TemplateProps) {
  const { template, apps } = props
  const navigate = useNavigate()
  const goToTemplatesPage = () => navigate(URLS.TEMPLATES)

  return (
    <Modal
      isOpen={true}
      onClose={goToTemplatesPage}
      size="4xl"
      motionPreset="none"
      isCentered
    >
      <ModalOverlay bg="base.canvas.overlay" />
      <ModalContent h={TEMPLATE_MODAL_HEIGHT} maxH="calc(100vh - 4rem)">
        <TemplatePreview template={template} apps={apps} replaceOnCreate />
      </ModalContent>
    </Modal>
  )
}

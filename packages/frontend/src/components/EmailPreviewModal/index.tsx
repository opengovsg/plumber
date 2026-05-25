import { lazy, Suspense } from 'react'
import { Center, Spinner } from '@chakra-ui/react'

const LazyEmailPreviewModal = lazy(() => import('./EmailPreviewModal'))

interface EmailPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  html: string
}

export default function EmailPreviewModal(props: EmailPreviewModalProps) {
  if (!props.isOpen) {
    return null
  }
  return (
    <Suspense
      fallback={
        <Center position="fixed" inset={0} zIndex="modal">
          <Spinner />
        </Center>
      }
    >
      <LazyEmailPreviewModal {...props} />
    </Suspense>
  )
}

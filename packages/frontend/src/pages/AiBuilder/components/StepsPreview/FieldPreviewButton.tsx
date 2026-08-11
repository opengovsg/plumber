import type { TFieldPreviewType } from '@plumber/types'

import { lazy, Suspense, useState } from 'react'
import { RiEyeLine } from 'react-icons/ri'
import { Button } from '@opengovsg/design-system-react'

const LazyViewAsEmailModal = lazy(() => import('@/components/ViewAsEmailModal'))

interface FieldPreviewButtonProps {
  previewType: TFieldPreviewType
  html: string
}

function renderPreviewModal(
  previewType: TFieldPreviewType,
  props: { isOpen: boolean; onClose: () => void; html: string },
) {
  switch (previewType) {
    case 'email':
      return <LazyViewAsEmailModal {...props} title="Preview your email" />
  }
}

export default function FieldPreviewButton({
  previewType,
  html,
}: FieldPreviewButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="xs"
        leftIcon={<RiEyeLine />}
        onMouseEnter={() => import('@/components/ViewAsEmailModal')}
        onClick={() => setIsOpen(true)}
      >
        Preview
      </Button>
      <Suspense fallback={null}>
        {isOpen &&
          renderPreviewModal(previewType, {
            isOpen,
            onClose: () => setIsOpen(false),
            html,
          })}
      </Suspense>
    </>
  )
}

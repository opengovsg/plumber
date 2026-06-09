import type { TFieldPreviewType } from '@plumber/types'

import {
  lazy,
  type MouseEvent,
  type ReactNode,
  Suspense,
  useCallback,
  useState,
  useTransition,
} from 'react'
import { RiEyeLine } from 'react-icons/ri'
import { Box, Spinner, Tooltip, useDisclosure } from '@chakra-ui/react'
import { Editor } from '@tiptap/react'

import { substituteForPreview, type VariableInfoMap } from './utils'

const LazyViewAsEmailModal = lazy(() => import('@/components/ViewAsEmailModal'))

interface PreviewerProps {
  isOpen: boolean
  onClose: () => void
  html: string
}

function usePreviewer(previewType: TFieldPreviewType | undefined) {
  const preloadPreviewer = useCallback(() => {
    switch (previewType) {
      case 'email':
        import('@/components/ViewAsEmailModal')
        break
    }
  }, [previewType])

  const renderPreviewer = useCallback(
    (props: PreviewerProps): ReactNode => {
      switch (previewType) {
        case 'email':
          return <LazyViewAsEmailModal {...props} title="Preview your email" />
      }
      return null
    },
    [previewType],
  )

  return { preloadPreviewer, renderPreviewer }
}

interface PreviewButtonProps {
  previewType: TFieldPreviewType | undefined
  editor: Editor
  variableMap: VariableInfoMap
}

export const PreviewButton = ({
  previewType,
  editor,
  variableMap,
}: PreviewButtonProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [html, setHtml] = useState('')
  const [isPending, startTransition] = useTransition()
  const { preloadPreviewer, renderPreviewer } = usePreviewer(previewType)

  if (!previewType) {
    return null
  }

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const newHtml = substituteForPreview(editor.getHTML(), variableMap)
    startTransition(() => {
      setHtml(newHtml)
      onOpen()
    })
  }

  return (
    <>
      <Box
        borderLeftWidth="2px"
        borderLeftStyle="dotted"
        borderColor="grey.300"
        alignSelf="stretch"
        mx={2}
        aria-hidden
      />
      <Tooltip label="Preview" hasArrow>
        <button
          type="button"
          aria-label="Preview"
          className="menu-item menu-item--preview"
          disabled={isPending}
          onMouseEnter={preloadPreviewer}
          onFocus={preloadPreviewer}
          onPointerDown={preloadPreviewer}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
        >
          {isPending ? <Spinner size="sm" /> : <RiEyeLine />}
        </button>
      </Tooltip>
      <Suspense fallback={null}>
        {isOpen && renderPreviewer({ isOpen, onClose, html })}
      </Suspense>
    </>
  )
}

export default PreviewButton

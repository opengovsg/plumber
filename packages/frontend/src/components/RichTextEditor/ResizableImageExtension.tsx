import { type CSSProperties, useCallback, useRef, useState } from 'react'
import { RiSendToBack } from 'react-icons/ri'
import TipTapImage from '@tiptap/extension-image'
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react'

const MIN_WIDTH = 60
const MAX_WIDTH = 750

const ResizableImageTemplate = ({ node, updateAttributes }: NodeViewProps) => {
  const imgRef = useRef<HTMLImageElement>(null)
  const [resizingStyle, setResizingStyle] = useState<
    Pick<CSSProperties, 'width'> | undefined
  >()

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (!imgRef.current) {
        return
      }
      event.preventDefault()

      const initialXPosition = event.clientX
      const currentWidth = imgRef.current.width
      let newWidth = currentWidth

      const removeListeners = () => {
        window.removeEventListener('mousemove', mouseMoveHandler)
        window.removeEventListener('mouseup', removeListeners)
        updateAttributes({ width: newWidth })
        setResizingStyle(undefined)
      }

      const mouseMoveHandler = (event: MouseEvent) => {
        newWidth = Math.max(
          currentWidth + (event.clientX - initialXPosition),
          MIN_WIDTH,
        )
        newWidth = Math.min(newWidth, MAX_WIDTH)
        setResizingStyle({ width: newWidth })

        // If mouse is up, remove event listeners
        if (!event.buttons) {
          removeListeners()
        }
      }

      window.addEventListener('mousemove', mouseMoveHandler)
      window.addEventListener('mouseup', removeListeners)
    },
    [updateAttributes],
  )

  return (
    <NodeViewWrapper as="span" draggable data-drag-handle>
      <div
        style={{
          width: resizingStyle?.width || node.attrs.width,
          display: 'inline-block',
        }}
      >
        <img
          {...node.attrs}
          ref={imgRef}
          style={Object.assign(
            {},
            {
              marginBottom: '-16px',
            },
            resizingStyle,
          )}
        />

        <div
          role="button"
          tabIndex={0}
          onMouseDown={handleMouseDown}
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <RiSendToBack />
        </div>
      </div>
    </NodeViewWrapper>
  )
}

const ResizableImageExtension = TipTapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { renderHTML: ({ width }) => ({ width }) },
      height: { renderHTML: ({ height }) => ({ height }) },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageTemplate)
  },
}).configure({ inline: true })

export default ResizableImageExtension

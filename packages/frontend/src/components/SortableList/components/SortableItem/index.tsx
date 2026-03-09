import './SortableItem.css'

import type { CSSProperties, PropsWithChildren } from 'react'
import { createContext, useContext } from 'react'
import type {
  DraggableSyntheticListeners,
  UniqueIdentifier,
} from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { EditorContext } from '@/contexts/Editor'

interface Props {
  id: UniqueIdentifier
}

interface Context {
  attributes: Record<string, any>
  listeners: DraggableSyntheticListeners
  ref(node: HTMLElement | null): void
  isDragging: boolean
  isOverlay: boolean
  isSorting: boolean
}

export const NESTED_DRAG_HANDLE_WIDTH = 16

export const SortableItemContext = createContext<Context>({
  attributes: {},
  listeners: undefined,
  ref() {
    // Empty implementation for default context
  },
  isDragging: false,
  isOverlay: false,
  isSorting: false,
})

export function SortableItem({
  children,
  id,
  isOverlay = false,
}: PropsWithChildren<Props & { isOverlay?: boolean }>) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isSorting,
  } = useSortable({ id })

  const style: CSSProperties = {
    opacity: isDragging ? 0.4 : undefined,
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <SortableItemContext.Provider
      value={{
        attributes,
        listeners,
        ref: setActivatorNodeRef,
        isDragging,
        isOverlay,

        isSorting,
      }}
    >
      <li className="SortableItem" ref={setNodeRef} style={style}>
        {children}
      </li>
    </SortableItemContext.Provider>
  )
}

export function DragHandle(props: {
  isNested?: boolean
  onWarningOpen?: () => void
}) {
  const { isNested, onWarningOpen } = props
  const { attributes, listeners, ref } = useContext(SortableItemContext)
  const { shouldWarnOnLeave } = useContext(EditorContext)

  return (
    <button
      className="DragHandle"
      {...attributes}
      {...listeners}
      ref={ref}
      {...(shouldWarnOnLeave && { onPointerDown: onWarningOpen })}
      style={{ padding: isNested ? '8px' : '12px' }}
    >
      <svg viewBox="0 0 20 20" width="12">
        <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
      </svg>
    </button>
  )
}

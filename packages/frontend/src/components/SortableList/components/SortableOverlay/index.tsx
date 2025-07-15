import type { DropAnimation } from '@dnd-kit/core'
import { defaultDropAnimationSideEffects, DragOverlay } from '@dnd-kit/core'

const dropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4',
      },
    },
  }),
}

interface SortableOverlayProps {
  children: React.ReactNode
}

export function SortableOverlay({ children }: SortableOverlayProps) {
  return (
    <DragOverlay dropAnimation={dropAnimationConfig}>{children}</DragOverlay>
  )
}

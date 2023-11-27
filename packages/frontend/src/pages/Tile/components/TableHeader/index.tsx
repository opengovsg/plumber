import { Fragment, memo, useCallback } from 'react'
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
} from '@dnd-kit/sortable'
import {
  ColumnFiltersState,
  ColumnOrderState,
  ColumnSizingState,
  flexRender,
  Header,
  SortingState,
} from '@tanstack/react-table'

import { NEW_COLUMN_ID, SELECT_COLUMN_ID } from '../../constants'
import { useUpdateTable } from '../../hooks/useUpdateTable'
import { GenericRowData } from '../../types'

interface TableHeaderProps {
  columnOrder: ColumnOrderState
  setColumnOrder: (columnOrder: string[]) => void
  headers: Header<GenericRowData, unknown>[]
  rowSelection: Record<string, boolean>
  sorting: SortingState
  columnSizing: ColumnSizingState
  columnFilters: ColumnFiltersState
}

function TableHeader({
  columnOrder,
  setColumnOrder,
  headers,
}: TableHeaderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: {
          x: 10,
        },
      },
    }),
  )

  const { updateColumns } = useUpdateTable()

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id) {
        const oldIndex = columnOrder.indexOf(active.id as string)
        const newIndex = columnOrder.indexOf(over.id as string)

        const newOrder = arrayMove(columnOrder, oldIndex, newIndex)
        setColumnOrder(newOrder)

        updateColumns(
          newOrder
            .filter((id) => ![NEW_COLUMN_ID, SELECT_COLUMN_ID].includes(id))
            .map((id, position) => ({ id, position })),
        )
      }
    },
    [columnOrder, setColumnOrder, updateColumns],
  )

  return (
    <DndContext
      sensors={sensors}
      autoScroll={{
        threshold: {
          x: 0.2, // default value in source code
          y: -1, // disable vertical scrolling when dragging
        },
      }}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToHorizontalAxis]}
    >
      <SortableContext
        items={columnOrder}
        strategy={horizontalListSortingStrategy}
      >
        {headers.map((header) => (
          <Fragment key={header.id}>
            {/* prevents new column from temporarily appearing after the + column */}
            {columnOrder.includes(header.id) &&
              flexRender(header.column.columnDef.header, header.getContext())}
          </Fragment>
        ))}
      </SortableContext>
    </DndContext>
  )
}

export default memo(TableHeader)

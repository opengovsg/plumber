import { useCallback } from 'react'
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
import { flexRender, Table } from '@tanstack/react-table'

import { NEW_COLUMN_ID } from '../constants'
import { useUpdateTable } from '../hooks/useUpdateTable'
import { GenericRowData } from '../types'

interface HeadersProps {
  table: Table<GenericRowData>
}

export default function Headers({ table }: HeadersProps) {
  const sensors = useSensors(useSensor(PointerSensor))

  const { updateColumns } = useUpdateTable()

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id) {
        const columnIds = table.getState().columnOrder
        const oldIndex = columnIds.indexOf(active.id as string)
        const newIndex = columnIds.indexOf(over.id as string)

        const newOrder = arrayMove(columnIds, oldIndex, newIndex)
        table.setColumnOrder(newOrder)

        updateColumns(
          newOrder
            .filter((id) => id !== NEW_COLUMN_ID)
            .map((id, position) => ({ id, position })),
        )
      }
    },
    [table, updateColumns],
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
        items={table.getState().columnOrder}
        strategy={horizontalListSortingStrategy}
      >
        {table
          .getFlatHeaders()
          .map((header) =>
            flexRender(header.column.columnDef.header, header.getContext()),
          )}
      </SortableContext>
    </DndContext>
  )
}

import { Fragment, useCallback } from 'react'
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

import { NEW_COLUMN_ID, SELECT_COLUMN_ID } from '../../constants'
import { useUpdateTable } from '../../hooks/useUpdateTable'
import { GenericRowData } from '../../types'

interface TableHeaderProps {
  table: Table<GenericRowData>
}

export default function TableHeader({ table }: TableHeaderProps) {
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
            .filter((id) => ![NEW_COLUMN_ID, SELECT_COLUMN_ID].includes(id))
            .map((id, position) => ({ id, position })),
        )
      }
    },
    [table, updateColumns],
  )
  const columnOrder = table.getState().columnOrder

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
        {table.getFlatHeaders().map((header) => (
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

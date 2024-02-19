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
import { flexRender, Header, TableState } from '@tanstack/react-table'

import { NEW_COLUMN_ID, SELECT_COLUMN_ID } from '../../constants'
import { useUpdateTable } from '../../hooks/useUpdateTable'
import { GenericRowData } from '../../types'

interface TableHeaderProps {
  tableState: TableState
  setColumnOrder: (columnOrder: string[]) => void
  headers: Header<GenericRowData, unknown>[]
}

function TableHeader({
  tableState,
  setColumnOrder,
  headers,
}: TableHeaderProps) {
  const { columnOrder } = tableState
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

export default memo(TableHeader, (prev, next) => {
  // Manually tell React to re-render TableHeader when the following properties change
  // passing tableState or table alone will cause headers to re-render on each cell change
  return (
    prev.tableState.columnOrder === next.tableState.columnOrder &&
    prev.tableState.columnSizing === next.tableState.columnSizing &&
    prev.tableState.columnFilters === next.tableState.columnFilters &&
    prev.tableState.sorting === next.tableState.sorting &&
    prev.tableState.rowSelection === next.tableState.rowSelection &&
    prev.headers === next.headers &&
    prev.setColumnOrder === next.setColumnOrder
  )
})

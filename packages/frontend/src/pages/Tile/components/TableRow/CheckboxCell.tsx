import { useCallback, useState } from 'react'
import { BsPlus } from 'react-icons/bs'
import { Icon } from '@chakra-ui/react'
import { CellContext } from '@tanstack/react-table'

import { Z_INDEX_CELL } from '../../constants'
import { useRowContext } from '../../contexts/RowContext'
import { CellType, GenericRowData } from '../../types'

export default function CheckboxCell({
  row,
  column,
  table,
}: CellContext<GenericRowData, unknown>) {
  const { sortedIndex, className, isHighlightingRow, backgroundColor } =
    useRowContext()
  const [onHover, setOnHover] = useState(false)
  const tableMeta = table.options.meta
  const selectFirstCell = useCallback(() => {
    const firstCell = row.getVisibleCells()[1]
    tableMeta?.setActiveCell(firstCell as CellType)
  }, [row, tableMeta])

  return (
    <div
      className={className}
      style={{
        width: `${column.getSize()}px`,
        flexShrink: 0,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--chakra-colors-primary-100)',
        borderTopWidth: 0,
        borderLeftWidth: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'sticky',
        left: 0,
        backgroundColor: isHighlightingRow
          ? 'var(--chakra-colors-orange-200)'
          : backgroundColor,
        zIndex: Z_INDEX_CELL.CHECKBOX,
        cursor: 'pointer',
      }}
      onClick={row.getCanSelect() ? undefined : selectFirstCell}
    >
      {row.getCanSelect() ? (
        <label
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            width: '100%',
            cursor: 'pointer',
            fontSize: '0.75rem',
          }}
          onMouseEnter={() => setOnHover(true)}
          onMouseLeave={() => setOnHover(false)}
        >
          {onHover || row.getIsSelected() ? (
            <input
              style={{
                cursor: 'pointer',
                accentColor: 'var(--chakra-colors-primary-500)',
              }}
              type="checkbox"
              checked={row.getIsSelected()}
              onChange={row.getToggleSelectedHandler()}
            />
          ) : (
            sortedIndex + 1
          )}
        </label>
      ) : (
        <Icon
          as={BsPlus}
          color="primary.500"
          _hover={{
            color: 'primary.600',
          }}
          w={6}
          h={6}
        />
      )}
    </div>
  )
}

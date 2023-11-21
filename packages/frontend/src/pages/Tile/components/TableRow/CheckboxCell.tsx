import { BsPlus } from 'react-icons/bs'
import { Icon } from '@chakra-ui/react'
import { CellContext } from '@tanstack/react-table'

import { GenericRowData } from '../../types'

export default function CheckboxCell({
  row,
  column,
}: CellContext<GenericRowData, unknown>) {
  return (
    <div
      style={{
        width: `${column.getSize()}px`,
        flexShrink: 0,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--chakra:-colors-primary-100)',
        borderTopWidth: 0,
        borderLeftWidth: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {row.getCanSelect() ? (
        <label
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            cursor: 'pointer',
          }}
        >
          <input
            style={{
              cursor: 'pointer',
              accentColor: 'var(--chakra-colors-primary-500)',
            }}
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        </label>
      ) : (
        <Icon as={BsPlus} color="primary.500" w={6} h={6} />
      )}
    </div>
  )
}

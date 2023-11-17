import { CellContext } from '@tanstack/react-table'

import { GenericRowData } from '../../types'

export default function CheckboxCell({
  row,
}: CellContext<GenericRowData, unknown>) {
  if (!row.getCanSelect()) {
    return null
  }

  return (
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
          height: '1rem',
          width: '1rem',
          cursor: 'pointer',
          accentColor: 'var(--chakra-colors-primary-500)',
        }}
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
      />
    </label>
  )
}

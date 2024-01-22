import { memo, useCallback } from 'react'
import { CellContext } from '@tanstack/react-table'

import { GenericRowData } from '../../types'

function NoopCell({ column, table }: CellContext<GenericRowData, unknown>) {
  const unFocusCell = useCallback(() => {
    table.options.meta?.setActiveCell(null)
  }, [table.options.meta])
  return (
    <div
      style={{
        background: 'white',
        height: '100%',
        width: column.getSize(),
      }}
      onClick={unFocusCell}
    />
  )
}

export default memo(NoopCell)

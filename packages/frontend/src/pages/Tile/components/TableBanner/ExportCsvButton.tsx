import { useCallback } from 'react'
import { BiChevronDown, BiExport } from 'react-icons/bi'
import { MenuButton, MenuItem, MenuList } from '@chakra-ui/react'
import { Button, Menu } from '@opengovsg/design-system-react'
import { saveAs } from 'file-saver'
import { dateString } from 'helpers/dateTime'
import { unparse } from 'papaparse'

import { useTableContext } from '../../contexts/TableContext'

const ExportCsvButton = () => {
  const { allDataRef, filteredDataRef, tableColumns, tableName } =
    useTableContext()

  const onExport = useCallback(
    ({ filtered }: { filtered: boolean }) => {
      const dataToSave =
        filtered && filteredDataRef.current.length
          ? filteredDataRef.current
          : allDataRef.current
      const columnIdToNameMap: Record<string, string> = {}
      tableColumns.forEach((column) => {
        columnIdToNameMap[column.id] = column.name
      })

      const mappedData = dataToSave.map((dataRow) => {
        const row: Record<string, string> = {}
        Object.entries(dataRow).forEach(([key, value]) => {
          row[columnIdToNameMap[key]] = value
        })
        return row
      })

      const csvString = unparse(mappedData, {
        columns: tableColumns.map((column) => column.name),
      })

      const filename = `${tableName
        .trim()
        .replace(/[^a-z0-9]|\r?\n|\r/gim, '')
        .replace(/\s+/g, '_')}_${dateString()}.csv`
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' })
      saveAs(blob, filename)
    },
    [filteredDataRef, allDataRef, tableColumns, tableName],
  )

  return (
    <Menu gutter={0} colorScheme="secondary">
      <MenuButton
        as={Button}
        variant="clear"
        colorScheme="secondary"
        size="xs"
        leftIcon={<BiExport />}
        rightIcon={<BiChevronDown />}
      >
        Export
      </MenuButton>
      <MenuList borderRadius="md">
        <MenuItem fontSize="sm" onClick={() => onExport({ filtered: false })}>
          All rows
        </MenuItem>
        <MenuItem fontSize="sm" onClick={() => onExport({ filtered: true })}>
          Rows with filters applied
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

export default ExportCsvButton

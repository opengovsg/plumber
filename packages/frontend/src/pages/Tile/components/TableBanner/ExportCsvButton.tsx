import { useCallback } from 'react'
import { BiChevronDown, BiExport, BiHelpCircle } from 'react-icons/bi'
import { Icon, MenuButton, MenuItem, MenuList } from '@chakra-ui/react'
import { Button, Menu, TouchableTooltip } from '@opengovsg/design-system-react'
import { saveAs } from 'file-saver'
import { dateString } from 'helpers/dateTime'
import { unparse } from 'papaparse'

import { useTableContext } from '../../contexts/TableContext'

const ExportCsvButton = () => {
  const { flattenedData, filteredDataRef, tableColumns, tableName } =
    useTableContext()

  const onExport = useCallback(
    ({ filtered }: { filtered: boolean }) => {
      const dataToSave =
        filtered && filteredDataRef.current.length
          ? filteredDataRef.current
          : flattenedData
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
    [filteredDataRef, flattenedData, tableColumns, tableName],
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
          Export all rows
        </MenuItem>
        <MenuItem fontSize="sm" onClick={() => onExport({ filtered: true })}>
          Export filtered rows
          <TouchableTooltip
            label="Export only rows shown by current filters"
            wrapperStyles={{
              lineHeight: 1,
            }}
            textAlign="center"
          >
            <Icon as={BiHelpCircle} fontSize="md" ml={1} />
          </TouchableTooltip>
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

export default ExportCsvButton

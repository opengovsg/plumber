import { forwardRef, useCallback } from 'react'
import { BiExport } from 'react-icons/bi'
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import { saveAs } from 'file-saver'
import { dateString } from 'helpers/dateTime'
import { unparse } from 'papaparse'

import { useTableContext } from '../../contexts/TableContext'

const ExportCsvModal = ({ onClose }: { onClose: () => void }) => {
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
    <Modal isOpen={true} onClose={onClose} motionPreset="none">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Text textStyle="h6">Export CSV</Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text mb={2}>Export all data in this table</Text>
          <Button onClick={() => onExport({ filtered: false })}>
            Export all
          </Button>
          <Text mt={4} mb={2}>
            Export rows based on current filter(s)
          </Text>
          <Button
            variant="outline"
            onClick={() => onExport({ filtered: true })}
          >
            Export filtered rows
          </Button>
        </ModalBody>

        <ModalFooter></ModalFooter>
      </ModalContent>
    </Modal>
  )
}

const ExportCsvButton = forwardRef<HTMLButtonElement>((_, ref) => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  return (
    <>
      <Button
        ref={ref}
        variant="clear"
        colorScheme="secondary"
        size="xs"
        onClick={onOpen}
        leftIcon={<BiExport />}
      >
        Export
      </Button>
      {/* unmount component when closed to reset all state */}
      {isOpen && <ExportCsvModal onClose={onClose} />}
    </>
  )
})

export default ExportCsvButton

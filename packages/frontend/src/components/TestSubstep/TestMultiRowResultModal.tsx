import { useMemo } from 'react'
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'

import { Variable } from '@/helpers/variables'

interface Column {
  key: string
  label: string
}

interface DataRow {
  id: string
  data: Record<string, string>
}

interface TestMultiRowResultModalProps {
  isOpen: boolean
  onClose: () => void
  variables: Variable[] | null
}

export default function TestMultiRowResultModal(
  props: TestMultiRowResultModalProps,
) {
  const { isOpen, onClose, variables } = props

  // Memoize the parsed data to avoid unnecessary re-parsing
  const { rowsFound, dataRows, columns } = useMemo(() => {
    const rowsFoundVar = variables?.find(
      (variable) => variable.label === 'No. of rows found',
    )

    const rowsVar = variables?.find((v) => v.label === 'Data rows')
    const parsedRows: DataRow[] = rowsVar
      ? JSON.parse(rowsVar.value as string)
      : []

    const columnVars =
      variables?.filter((v) => v.name.includes('columns')) || []
    const parsedColumns: Column[] = columnVars.map((c) => ({
      key: c.value as string,
      label: c.label || '',
    }))

    return {
      rowsFound: rowsFoundVar?.value as string,
      dataRows: parsedRows,
      columns: parsedColumns,
    }
  }, [variables])

  if (!variables) {
    return null
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="6xl"
      motionPreset="none"
      isCentered
    >
      <ModalOverlay />
      <ModalContent maxH="80vh" overflow="hidden">
        <ModalHeader
          position="sticky"
          top={0}
          bg="white"
          zIndex={1}
          borderBottom="1px solid"
          borderColor="base.divider.medium"
        >
          Found {rowsFound} rows
          <ModalCloseButton />
        </ModalHeader>
        <ModalBody>
          <TableContainer mt={4} overflowY="scroll" maxH="calc(80vh - 100px)">
            <Table variant="simple">
              <Thead position="sticky" top={0} bg="white" zIndex={1}>
                <Tr>
                  {columns.map((c) => (
                    <Th key={c.key}>{c.label}</Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {dataRows.map((row) => (
                  <Tr key={row.id}>
                    {columns.map((c) => (
                      <Td key={c.key}>{row.data[c.key] ?? ''}</Td>
                    ))}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

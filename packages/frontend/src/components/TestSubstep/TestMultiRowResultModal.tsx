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
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'

import { Variable } from '@/helpers/variables'
import { BORDER_COLOR, FONT_SIZE, ROW_COLOR } from '@/pages/Tile/constants'

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
      <ModalContent maxH="80vh" overflow="hidden" borderRadius="lg">
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
          <TableContainer
            my={2}
            maxH="calc(80vh - 100px)"
            overflowY="auto"
            border="1px solid"
            borderColor={BORDER_COLOR.DEFAULT}
            borderRadius="md"
          >
            <Table variant="simple">
              <Thead
                position="sticky"
                top={0}
                bg="var(--chakra-colors-primary-50)"
                zIndex={1}
              >
                <Tr>
                  <Th
                    borderRightWidth="1px"
                    borderColor={BORDER_COLOR.DEFAULT}
                  />
                  {columns.map((c, colIndex) => (
                    <Th
                      key={c.key}
                      borderColor={BORDER_COLOR.DEFAULT}
                      borderRightWidth={
                        colIndex === columns.length - 1 ? 0 : '1px'
                      }
                    >
                      <Text
                        fontSize={FONT_SIZE.DEFAULT}
                        overflow="hidden"
                        whiteSpace="nowrap"
                        textOverflow="ellipsis"
                        maxW="100%"
                        textStyle="subhead-2"
                        userSelect="none"
                        textTransform="none"
                      >
                        {c.label}
                      </Text>
                    </Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {dataRows.map((row, index) => (
                  <Tr
                    key={row.id}
                    backgroundColor={index % 2 ? ROW_COLOR.EVEN : ROW_COLOR.ODD}
                    borderColor={BORDER_COLOR.DEFAULT}
                  >
                    <Td
                      borderColor={BORDER_COLOR.DEFAULT}
                      borderRightWidth="1px"
                      fontSize={FONT_SIZE.SMALL}
                    >
                      {index + 1}
                    </Td>
                    {columns.map((c, colIndex) => (
                      <Td
                        key={c.key}
                        borderColor={BORDER_COLOR.DEFAULT}
                        borderRightWidth={
                          colIndex === columns.length - 1 ? 0 : '1px'
                        }
                        fontSize={FONT_SIZE.DEFAULT}
                      >
                        {row.data[c.key] ?? ''}
                      </Td>
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

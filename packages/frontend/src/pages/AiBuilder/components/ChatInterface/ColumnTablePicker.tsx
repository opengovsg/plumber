import {
  Box,
  Checkbox,
  Flex,
  Icon,
  Input,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { useState } from 'react'
import { FaArrowCircleUp } from 'react-icons/fa'
import { FaCircleStop } from 'react-icons/fa6'

import type { ColumnTableData } from '@/hooks/useChatStream'

import {
  buildEditableRows,
  type EditableColumnRow,
} from './helpers/columnTableReply'

interface ColumnTablePickerProps {
  data: ColumnTableData
  isStreaming: boolean
  onSave: (rows: EditableColumnRow[]) => void
  cancelStream: () => void
}

export default function ColumnTablePicker({
  data,
  isStreaming,
  onSave,
  cancelStream,
}: ColumnTablePickerProps) {
  const [rows, setRows] = useState<EditableColumnRow[]>(() =>
    buildEditableRows(data),
  )

  const toggleRow = (id: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, checked: !row.checked } : row,
      ),
    )
  }

  const setRowValue = (id: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, value } : row)),
    )
  }

  return (
    <Box w="full" maxW="4xl">
      <Box
        bg="white"
        border="1px"
        borderColor="gray.200"
        borderRadius="16px"
        boxShadow="0 2px 4px rgba(0,0,0,0.1)"
        p={4}
        w="full"
      >
        <Text mb={2}>{data.question}</Text>

        <Box maxH="360px" overflowY="auto">
          <Table size="sm" variant="simple" sx={{ tableLayout: 'fixed' }}>
            <Thead>
              <Tr>
                <Th w="10%" />
                <Th>Column</Th>
                <Th>Value</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <Checkbox
                      isChecked={row.checked}
                      onChange={() => toggleRow(row.id)}
                      isDisabled={isStreaming}
                      aria-label={`Include ${row.name}`}
                    />
                  </Td>
                  <Td>{row.name}</Td>
                  <Td>
                    <Input
                      size="sm"
                      value={row.value}
                      onChange={(e) => setRowValue(row.id, e.target.value)}
                      isDisabled={isStreaming || !row.checked}
                      placeholder="Enter a value"
                      aria-label={`Value for ${row.name}`}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>

        <Box borderTop="1px" borderColor="gray.100" mt={4} pt={3}>
          <Flex justify="flex-end" align="center" h="24px">
            {isStreaming ? (
              <Icon
                as={FaCircleStop}
                fontSize="24px"
                color="red.500"
                cursor="pointer"
                onClick={cancelStream}
                _hover={{ color: 'red.600' }}
              />
            ) : (
              <Icon
                as={FaArrowCircleUp}
                fontSize="24px"
                color="primary.500"
                onClick={() => onSave(rows)}
                cursor="pointer"
              />
            )}
          </Flex>
        </Box>
      </Box>
    </Box>
  )
}

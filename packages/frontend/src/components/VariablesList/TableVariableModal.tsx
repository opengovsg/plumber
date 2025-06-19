import { IExecutionStep } from '@plumber/types'

import {
  Flex,
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

import { BORDER_COLOR, FONT_SIZE, ROW_COLOR } from '@/pages/Tile/constants'

import { processData, ProcessedColumn, ProcessedRow } from './utils'

interface TableVariableModalProps {
  isOpen: boolean
  onClose: () => void
  currentExecutionStep?: IExecutionStep | null
}

const TableHeader = ({ columns }: { columns: ProcessedColumn[] }) => (
  <Thead
    position="sticky"
    top={0}
    bg="var(--chakra-colors-primary-50)"
    zIndex={1}
  >
    <Tr key="header-row">
      <Th borderRightWidth="1px" borderColor={BORDER_COLOR.DEFAULT}>
        #
      </Th>
      {columns?.map((c, colIndex) => (
        <Th
          key={c.key}
          borderColor={BORDER_COLOR.DEFAULT}
          borderRightWidth={colIndex === columns.length - 1 ? 0 : '1px'}
        >
          <Text
            fontSize={FONT_SIZE.DEFAULT}
            overflow="hidden"
            whiteSpace="nowrap"
            textOverflow="ellipsis"
            maxW="100%"
            textStyle="subhead-2"
            textTransform="none"
          >
            {c.label}
          </Text>
        </Th>
      ))}
    </Tr>
  </Thead>
)

const TableRow = ({
  row,
  index,
  columns,
}: {
  row: ProcessedRow
  index: number
  columns: ProcessedColumn[]
}) => (
  <Tr
    backgroundColor={index % 2 ? ROW_COLOR.EVEN : ROW_COLOR.ODD}
    borderColor={BORDER_COLOR.DEFAULT}
  >
    <Td
      borderColor={BORDER_COLOR.DEFAULT}
      borderRightWidth="1px"
      fontSize={FONT_SIZE.SMALL}
      textAlign="center"
      width="50px"
    >
      {index + 1}
    </Td>
    {columns?.map((c, colIndex) => (
      <Td
        key={c.key}
        borderColor={BORDER_COLOR.DEFAULT}
        borderRightWidth={colIndex === columns.length - 1 ? 0 : '1px'}
        fontSize={FONT_SIZE.DEFAULT}
      >
        {row.data[c.key] ?? ''}
      </Td>
    ))}
  </Tr>
)

export default function TableVariableModal(props: TableVariableModalProps) {
  const { isOpen, onClose, currentExecutionStep } = props

  if (!currentExecutionStep) {
    return null
  }
  const { rowsFound, dataRows, columns } = processData(currentExecutionStep)

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
          <Flex direction="column">
            Row(s) found
            <Text textStyle="body-2" color="base.content.medium">
              {rowsFound} row(s)
            </Text>
          </Flex>
          <ModalCloseButton />
        </ModalHeader>
        <ModalBody>
          <TableContainer
            my={2}
            maxH="calc(75vh - 100px)"
            overflowY="auto"
            border="1px solid"
            borderColor={BORDER_COLOR.DEFAULT}
            borderRadius="md"
          >
            <Table variant="simple">
              <TableHeader columns={columns} />
              <Tbody>
                {dataRows.map((row, index) => (
                  <TableRow
                    key={row.rowId ?? `${row.id}-${index}`}
                    row={row}
                    index={index}
                    columns={columns}
                  />
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

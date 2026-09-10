import {
  Box,
  Button,
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
import { IconButton } from '@opengovsg/design-system-react'
import { useState } from 'react'
import { BiTrash } from 'react-icons/bi'
import { FaArrowCircleUp, FaPlus } from 'react-icons/fa'
import { FaCircleStop } from 'react-icons/fa6'

import type { TileSetupData } from '@/hooks/useChatStream'

import { initialTileSetupState } from './helpers/tileSetupReply'

interface TileSetupPickerProps {
  data: TileSetupData
  isStreaming: boolean
  onSave: (name: string | null, columns: string[]) => void
  cancelStream: () => void
}

export default function TileSetupPicker({
  data,
  isStreaming,
  onSave,
  cancelStream,
}: TileSetupPickerProps) {
  const [state, setState] = useState(() => initialTileSetupState(data))
  const showName = state.name !== null
  const canSave =
    state.columns.some((column) => column.trim()) &&
    (!showName || Boolean(state.name?.trim()))

  const setColumn = (index: number, value: string) => {
    setState((prev) => ({
      ...prev,
      columns: prev.columns.map((column, i) => (i === index ? value : column)),
    }))
  }

  const addColumn = () => {
    setState((prev) => ({ ...prev, columns: [...prev.columns, ''] }))
  }

  const removeColumn = (index: number) => {
    setState((prev) => ({
      ...prev,
      columns: prev.columns.filter((_, i) => i !== index),
    }))
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

        {showName && (
          <Box mb={3}>
            <Text fontSize="sm" fontWeight="medium" mb={1}>
              Tile name
            </Text>
            <Input
              size="sm"
              value={state.name ?? ''}
              onChange={(e) =>
                setState((prev) => ({ ...prev, name: e.target.value }))
              }
              isDisabled={isStreaming}
              placeholder="Enter a tile name"
              aria-label="Tile name"
            />
          </Box>
        )}

        <Box maxH="360px" overflowY="auto">
          <Table size="sm" variant="unstyled" sx={{ tableLayout: 'fixed' }}>
            <Thead>
              <Tr>
                <Th>Column</Th>
                <Th w="10%" />
              </Tr>
            </Thead>
            <Tbody>
              {state.columns.map((column, index) => (
                <Tr key={index}>
                  <Td>
                    <Input
                      size="sm"
                      value={column}
                      onChange={(e) => setColumn(index, e.target.value)}
                      isDisabled={isStreaming}
                      placeholder="Enter a column name"
                      aria-label={`Column ${index + 1}`}
                    />
                  </Td>
                  <Td>
                    {state.columns.length > 1 && (
                      <IconButton
                        variant="clear"
                        aria-label={`Remove column ${index + 1}`}
                        icon={<BiTrash />}
                        isDisabled={isStreaming}
                        onClick={() => removeColumn(index)}
                        colorScheme="secondary"
                      />
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>

        <Button
          variant="link"
          size="sm"
          mt={2}
          leftIcon={<FaPlus />}
          isDisabled={isStreaming}
          onClick={addColumn}
        >
          Add column
        </Button>

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
              canSave && (
                <Icon
                  as={FaArrowCircleUp}
                  fontSize="24px"
                  color="primary.500"
                  onClick={() => onSave(state.name, state.columns)}
                  cursor="pointer"
                />
              )
            )}
          </Flex>
        </Box>
      </Box>
    </Box>
  )
}

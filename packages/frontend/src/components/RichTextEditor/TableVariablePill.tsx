import { useCallback, useContext, useMemo } from 'react'
import {
  Badge,
  Box,
  Checkbox,
  Flex,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Portal,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react'
import { Button, TouchableTooltip } from '@opengovsg/design-system-react'
import { Node } from '@tiptap/pm/model'
import { NodeViewWrapper } from '@tiptap/react'

import { EditorContext } from '@/contexts/Editor'
import { hexDecode, hexEncode } from '@/helpers/hex-encoding'
import { TableVariable } from '@/helpers/variables'
import { POPOVER_OPACITY_MOTION_PROPS } from '@/theme/constants'

import { RichTextEditorContext } from './RichTextEditorContext'

interface TableVariablePillProps {
  node: Node
  updateAttributes: (attrs: Record<string, unknown>) => void
  selected: boolean
}

// Layout constants
const COL_WIDTH = 200
const ROW_HEIGHT = 44
const TABLE_HEIGHT = ROW_HEIGHT * 4

type ErrorType =
  | 'unsupported_field'
  | 'missing_variable'
  | 'invalid_format'
  | 'invalid_columns'
  | null

const ERROR_MESSAGES: Record<Exclude<ErrorType, null>, string> = {
  unsupported_field: 'Table variable not supported here',
  missing_variable:
    'This is a missing variable, check your previous steps and reselect a variable',
  invalid_format: 'Invalid table format detected, reselect a table variable',
  invalid_columns: 'Invalid columns detected, reselect a table variable',
}

function getBasePath(id: string): string {
  return id.replace(/\|[a-fA-F0-9]+$/, '')
}

interface ParsedModifier {
  isValid: boolean
  columnIds: string[]
  hasTablePrefix: boolean
}

function parseTableModifier(id: string): ParsedModifier {
  const match = id.match(/\|([a-fA-F0-9]+)$/)
  if (!match) {
    return { isValid: false, columnIds: [], hasTablePrefix: false }
  }
  try {
    const decoded = hexDecode(match[1])
    const hasTablePrefix = decoded.startsWith('table:')
    if (!hasTablePrefix) {
      return { isValid: false, columnIds: [], hasTablePrefix: false }
    }
    const columnIds = decoded.slice(6).split(',').filter(Boolean)
    return { isValid: columnIds.length > 0, columnIds, hasTablePrefix }
  } catch {
    return { isValid: false, columnIds: [], hasTablePrefix: false }
  }
}

function ErrorBadge({ message }: { message: string }) {
  return (
    <NodeViewWrapper as="span">
      <TouchableTooltip
        motionProps={POPOVER_OPACITY_MOTION_PROPS}
        label={message}
      >
        <Badge
          display="inline-flex"
          borderRadius="full"
          px={3}
          py={1}
          bg="transparent"
          borderWidth="2px"
          borderStyle="dashed"
          borderColor="primary.500"
          cursor="default"
          data-content="empty"
          fontSize="sm"
        >
          <Text color="base.content.strong" fontSize="sm" fontWeight="medium">
            Table
          </Text>
        </Badge>
      </TouchableTooltip>
    </NodeViewWrapper>
  )
}

export function TableVariablePill({
  node,
  updateAttributes,
  selected,
}: TableVariablePillProps): JSX.Element {
  const { stepsWithVars } = useContext(EditorContext)
  const { closeSuggestions, openSuggestions, supportTableDisplay } = useContext(
    RichTextEditorContext,
  )

  const id = node.attrs.id as string
  const basePath = useMemo(() => getBasePath(id), [id])
  const parsedModifier = useMemo(() => parseTableModifier(id), [id])

  const tableVar = useMemo(() => {
    for (const step of stepsWithVars) {
      for (const v of step.output) {
        if (v.type === 'table' && v.name === basePath) {
          return v as TableVariable
        }
      }
    }
    return null
  }, [stepsWithVars, basePath])

  const validColumns = useMemo(() => {
    if (!tableVar?.columns) {
      return []
    }
    return parsedModifier.columnIds
      .map((colId) => tableVar.columns.find((c) => c.id === colId))
      .filter((col): col is { id: string; name: string } => col !== undefined)
  }, [tableVar?.columns, parsedModifier.columnIds])

  const errorType: ErrorType = useMemo(() => {
    if (!supportTableDisplay) {
      return 'unsupported_field'
    }
    if (!tableVar) {
      return 'missing_variable'
    }
    if (!parsedModifier.hasTablePrefix) {
      return 'invalid_format'
    }
    if (
      validColumns.length === 0 ||
      validColumns.length !== parsedModifier.columnIds.length
    ) {
      return 'invalid_columns'
    }
    return null
  }, [
    supportTableDisplay,
    tableVar,
    parsedModifier.hasTablePrefix,
    parsedModifier.columnIds.length,
    validColumns.length,
  ])

  const handleToggle = useCallback(
    (colId: string) => {
      if (!tableVar?.columns) {
        return
      }
      const currentCols = parsedModifier.columnIds
      let newCols: string[]
      if (currentCols.includes(colId)) {
        if (currentCols.length === 1) {
          return
        }
        newCols = currentCols.filter((c) => c !== colId)
      } else {
        newCols = tableVar.columns
          .map((c) => c.id)
          .filter((c) => currentCols.includes(c) || c === colId)
      }
      const hex = hexEncode(`table:${newCols.join(',')}`)
      updateAttributes({ id: `${basePath}|${hex}` })
    },
    [tableVar?.columns, parsedModifier.columnIds, basePath, updateAttributes],
  )

  if (errorType) {
    return <ErrorBadge message={ERROR_MESSAGES[errorType]} />
  }

  const stepId = basePath.startsWith('step.') ? basePath.split('.')[1] : null
  const stepName = stepsWithVars.find((s) => s.id === stepId)?.name ?? 'Table'
  const label = tableVar?.label ?? stepName
  const displayValue =
    tableVar?.displayedValue ?? `${tableVar?.totalRowCount ?? 0} rows`
  const sampleRows = tableVar?.sampleRows ?? []
  const allColumns = tableVar?.columns ?? []

  return (
    <NodeViewWrapper as="span">
      <Box
        display="inline-block"
        verticalAlign="top"
        maxW="100%"
        onClick={(e) => {
          e.stopPropagation()
          openSuggestions()
        }}
      >
        {/* Badge */}
        <TouchableTooltip
          motionProps={POPOVER_OPACITY_MOTION_PROPS}
          label={stepName}
        >
          <Badge
            display="inline-flex"
            gap={1}
            borderRadius="full"
            px={3}
            py={1}
            maxW="50%"
            bg="primary.100"
            borderWidth={selected ? '2px' : '0'}
            borderStyle="solid"
            borderColor={selected ? 'primary.500' : 'transparent'}
            cursor="default"
            fontSize="sm"
          >
            <Text color="base.content.strong" isTruncated>
              {label}
            </Text>
            <Text color="base.content.medium" isTruncated>
              {displayValue}
            </Text>
          </Badge>
        </TouchableTooltip>

        {/* Table preview */}
        <Box
          mt={2}
          bg="white"
          w="fit-content"
          maxW="100%"
          borderRadius="md"
          outline={selected ? '2px solid' : undefined}
          outlineColor={selected ? 'primary.500' : undefined}
        >
          {/* Table content — clicks bubble up to outer Box to open suggestions */}
          <Box
            overflowX="auto"
            overflowY="hidden"
            borderTopRadius="md"
            border="1px solid"
            borderColor="gray.200"
            borderBottom="none"
          >
            <Box
              position="relative"
              w={`${validColumns.length * COL_WIDTH}px`}
              maxH={`${TABLE_HEIGHT}px`}
            >
              <Table variant="simple" className="table-variable-pill">
                <Thead>
                  <Tr>
                    {validColumns.map((col) => (
                      <Th
                        key={col.id}
                        w={`${COL_WIDTH}px`}
                        h={`${ROW_HEIGHT}px`}
                        textTransform="none"
                      >
                        <Text isTruncated textStyle="subhead-2">
                          {col.name}
                        </Text>
                      </Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {sampleRows.map((row, rowIndex) => (
                    <Tr key={rowIndex}>
                      {validColumns.map((col) => (
                        <Td key={col.id} h={`${ROW_HEIGHT}px`}>
                          <Text isTruncated textStyle="body-2">
                            {String(row[col.id] ?? '')}
                          </Text>
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </Tbody>
              </Table>

              {(tableVar?.totalRowCount ?? 0) > 2 && (
                <Box
                  position="absolute"
                  bottom={0}
                  left={0}
                  right={0}
                  h="40px"
                  bgGradient="linear(to-t, white, transparent)"
                  pointerEvents="none"
                />
              )}
            </Box>
          </Box>

          {/* Footer — stopPropagation blocks outer Box's openSuggestions */}
          <Flex
            p={4}
            border="1px solid"
            borderColor="gray.200"
            borderBottomRadius="md"
            justify="space-between"
            align="center"
            onClick={(e) => e.stopPropagation()}
          >
            <Text color="gray.600" textStyle="body-2">
              {validColumns.length} column{validColumns.length !== 1 ? 's' : ''}
            </Text>
            <Popover placement="bottom-end" isLazy>
              <PopoverTrigger>
                <Button
                  variant="link"
                  size="sm"
                  color="primary.500"
                  onClick={closeSuggestions}
                >
                  Edit
                </Button>
              </PopoverTrigger>
              <Portal>
                <PopoverContent w="280px">
                  <PopoverHeader fontWeight="semibold" fontSize="sm">
                    Select columns
                  </PopoverHeader>
                  <PopoverBody maxH="225px" overflowY="auto">
                    {allColumns.map((col) => (
                      <Checkbox
                        key={col.id}
                        isChecked={parsedModifier.columnIds.includes(col.id)}
                        onChange={() => handleToggle(col.id)}
                        isDisabled={
                          parsedModifier.columnIds.length === 1 &&
                          parsedModifier.columnIds.includes(col.id)
                        }
                        mb={2}
                        size="sm"
                        w="100%"
                      >
                        <Text fontSize="sm" isTruncated maxW="220px">
                          {col.name}
                        </Text>
                      </Checkbox>
                    ))}
                  </PopoverBody>
                </PopoverContent>
              </Portal>
            </Popover>
          </Flex>
        </Box>
      </Box>
    </NodeViewWrapper>
  )
}

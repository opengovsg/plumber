import { ITableColumnMetadata, ITableMetadata } from '@plumber/types'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BiCheck, BiChevronDown, BiChevronUp, BiImport } from 'react-icons/bi'
import { useLazyQuery, useMutation } from '@apollo/client'
import {
  Box,
  Card,
  Collapse,
  Flex,
  List,
  ListIcon,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  Text,
  useBoolean,
  useDisclosure,
} from '@chakra-ui/react'
import {
  Attachment,
  Button,
  ButtonProps,
  Spinner,
} from '@opengovsg/design-system-react'
import { CREATE_ROWS } from 'graphql/mutations/create-rows'
import { GET_ALL_ROWS } from 'graphql/queries/get-all-rows'
import { GET_TABLE } from 'graphql/queries/get-table'
import { chunk } from 'lodash'
import Papa, { ParseMeta, ParseResult } from 'papaparse'
import { SetRequired } from 'type-fest'

import { useTableContext } from '../../contexts/TableContext'
import { useUpdateTable } from '../../hooks/useUpdateTable'

interface ValidParseResult extends ParseResult<Record<string, string>> {
  meta: SetRequired<ParseMeta, 'fields'>
}

type IMPORT_STATUS =
  | 'ready'
  | 'creating columns'
  | 'importing'
  | 'completed'
  | 'error'

// 2 MB in bytes
const MAX_FILE_SIZE = 2 * 1000 * 1000
// Add row chunk size
const CHUNK_SIZE = 100

const ImportStatus = ({
  columnsToCreate,
  errorMsg,
  importStatus,
  rowsImported,
  rowsToImport,
}: {
  columnsToCreate: string[]
  errorMsg: string | null
  importStatus: IMPORT_STATUS
  rowsImported: number
  rowsToImport: number
}) => {
  const [isColumnDataExpanded, setIsColumnDataExpanded] = useBoolean(false)

  switch (importStatus) {
    case 'ready':
      if (!columnsToCreate.length) {
        return null
      }
      return (
        <>
          <Button
            colorScheme="secondary"
            variant="link"
            onClick={setIsColumnDataExpanded.toggle}
            rightIcon={
              isColumnDataExpanded ? <BiChevronUp /> : <BiChevronDown />
            }
          >
            {columnsToCreate.length} column(s) to create
          </Button>
          <Collapse in={isColumnDataExpanded}>
            <List spacing={3} mt={4}>
              {columnsToCreate.map((field, i) => {
                return (
                  <Flex key={i} alignItems="center">
                    <ListIcon as={BiCheck} />
                    <ListItem>{field}</ListItem>
                  </Flex>
                )
              })}
            </List>
          </Collapse>
        </>
      )
    case 'creating columns':
      return (
        <Box>
          <Text>Creating Columns</Text>
          <Progress mt={3} size="xs" isIndeterminate />
        </Box>
      )
    case 'importing':
      return (
        <Box>
          <Text>{`Importing rows ${rowsImported} of ${rowsToImport}`}</Text>
          <Progress mt={3} size="xs" value={rowsImported} max={rowsToImport} />
        </Box>
      )
    case 'completed':
      return (
        <Box>
          <Text>{`${rowsToImport} rows imported`}</Text>
          <Progress my={3} size="xs" value={100} />
        </Box>
      )
    case 'error':
      return <Text color="red.500">Error: {errorMsg}</Text>
  }
}

export const ImportCsvModalContent = ({
  onClose,
  onPreImport,
  onPostImport,
  onBack,
}: {
  onClose: () => void
  // these optional args are used for new table creation via import
  onPreImport?: () => Promise<ITableMetadata | undefined>
  onPostImport?: () => void
  onBack?: () => void
}) => {
  const { tableId, tableColumns } = useTableContext()
  const { createColumns } = useUpdateTable()
  const [createRows] = useMutation(CREATE_ROWS)
  const [getTableData] = useLazyQuery<{
    getTable: ITableMetadata
  }>(GET_TABLE, {
    variables: {
      tableId,
    },
  })

  const columnNamesSet = useMemo(
    () => new Set(tableColumns.map((column) => column.name)),
    [tableColumns],
  )

  const [importStatus, setImportStatus] = useState<IMPORT_STATUS>('ready')
  const isImporting =
    importStatus === 'importing' || importStatus === 'creating columns'
  const [rowsToImport, setRowsToImport] = useState(0)
  const [rowsImported, setRowsImported] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [result, setResult] = useState<Record<string, string>[] | null>(null)
  const [columnsToCreate, setColumnsToCreate] = useState<string[]>([])
  // Used for new table creation via import
  // This is used to check if the import has already started, so it doesnt run on every render
  const importStartedRef = useRef(false)

  const [file, setFile] = useState<File>()

  const isValidParseResult = useCallback(
    (parseResult: ParseResult<unknown>): parseResult is ValidParseResult => {
      return !!parseResult.meta.fields && parseResult.meta.fields.length > 0
    },
    [],
  )

  useEffect(() => {
    if (!file) {
      setIsParsing(false)
      setResult(null)
      setImportStatus('ready')
      setRowsToImport(0)
      setRowsImported(0)
      return
    }
    setIsParsing(true)
    Papa.parse(file, {
      // transform empty headers to '(empty)'
      transformHeader: (header) => header.trim() || '(empty)',
      header: true,
      skipEmptyLines: true,
      complete: (parseResult) => {
        setIsParsing(false)
        if (isValidParseResult(parseResult)) {
          setResult(parseResult.data)
          const columns = parseResult.meta.fields
          setColumnsToCreate(
            columns.filter((csvColumn) => !columnNamesSet.has(csvColumn)),
          )
        }
      },
    })
  }, [columnNamesSet, file, isValidParseResult])

  const createNewColumns = useCallback(async () => {
    await createColumns(columnsToCreate, onPreImport === undefined)
    const { data: updatedTableData } = await getTableData()
    if (!updatedTableData) {
      throw new Error('Unable to fetch updated table data')
    }
    return updatedTableData.getTable.columns
  }, [columnsToCreate, createColumns, getTableData, onPreImport])

  const mapDataToColumnIds = useCallback(
    (
      allColumns: ITableColumnMetadata[],
      data: Record<string, string>[],
    ): Record<string, string>[] => {
      const columnNameToIdMap: Record<string, string> = {}
      allColumns.forEach(({ name, id }) => {
        columnNameToIdMap[name] = id
      })
      return data.map((row) => {
        const mappedRow: Record<string, string> = {}
        for (const [key, value] of Object.entries(row)) {
          const columnId = columnNameToIdMap[key]
          if (!columnId) {
            throw new Error('Column not found')
          }
          mappedRow[columnId] = value
        }
        return mappedRow
      })
    },
    [],
  )

  const onImport = useCallback(async () => {
    // do not import if no rows or columns to create
    if (!result?.length && !columnsToCreate.length) {
      return
    }
    try {
      setImportStatus('creating columns')
      let allColumns = tableColumns
      if (columnsToCreate.length) {
        allColumns = await createNewColumns()
      }

      // skip if no rows to import
      if (result?.length) {
        const mappedData = mapDataToColumnIds(allColumns, result)
        setImportStatus('importing')
        setRowsToImport(mappedData.length)
        setRowsImported(0)
        const chunkedData = chunk(mappedData, CHUNK_SIZE)

        for (let i = 0; i < chunkedData.length; i++) {
          await createRows({
            variables: {
              input: {
                tableId,
                dataArray: chunkedData[i],
              },
            },
            refetchQueries:
              i === chunkedData.length - 1 && !onPreImport
                ? [GET_ALL_ROWS]
                : undefined,
            awaitRefetchQueries: true,
          })
          setRowsImported((i + 1) * CHUNK_SIZE)
        }
      }
      setImportStatus('completed')
      if (onPostImport) {
        setTimeout(() => onPostImport(), 1000)
      }
    } catch (e) {
      setImportStatus('error')
      if (e instanceof Error) {
        setErrorMsg(e.message)
      }
    }
  }, [
    columnsToCreate.length,
    createNewColumns,
    createRows,
    mapDataToColumnIds,
    onPostImport,
    onPreImport,
    result,
    tableColumns,
    tableId,
  ])

  /**
   * This is for new table creation via import
   * We do not call the onImport function directly since we want the tableId in the context to be updated first
   * so we rely on the side effect of context change to trigger the onImport function
   */
  useEffect(() => {
    if (onPreImport && !importStartedRef.current && tableId.length > 0) {
      importStartedRef.current = true
      onImport()
    }
  }, [onImport, onPreImport, tableId])

  return (
    <>
      <ModalHeader>Import CSV</ModalHeader>
      {!isImporting && <ModalCloseButton />}
      <ModalBody>
        <Text my={4}>
          Any imported data will be appended as new cells and will not overwrite
          existing values.
        </Text>
        <Attachment
          maxSize={MAX_FILE_SIZE}
          onChange={setFile}
          title="Upload CSV"
          name="file-upload"
          colorScheme="primary"
          showFileSize={true}
          accept={['.csv']}
          isReadOnly={importStatus !== 'ready' && importStatus !== 'error'}
          value={file}
        />
        {file && (
          <Card p={4} mt={2} shadow="none">
            {isParsing ? (
              <Flex>
                <Spinner mr={2} color="primary.600" />
                Parsing file...
              </Flex>
            ) : (
              <ImportStatus
                columnsToCreate={columnsToCreate}
                errorMsg={errorMsg}
                importStatus={importStatus}
                rowsImported={rowsImported}
                rowsToImport={rowsToImport}
              />
            )}
          </Card>
        )}
      </ModalBody>

      <ModalFooter>
        <Flex gap={4}>
          {onBack && importStatus === 'ready' && (
            <Button variant="clear" colorScheme="secondary" onClick={onBack}>
              Back
            </Button>
          )}
          {importStatus === 'completed' && (
            <Button isDisabled={!!onPreImport} onClick={onClose}>
              {onPreImport ? 'Redirecting...' : 'Done'}
            </Button>
          )}
          {importStatus !== 'completed' && (
            <Button
              isLoading={isImporting}
              isDisabled={!result?.length && !columnsToCreate.length}
              onClick={onPreImport ? onPreImport : onImport}
            >
              Import {result ? result?.length + ' rows' : ''}
            </Button>
          )}
        </Flex>
      </ModalFooter>
    </>
  )
}

const ImportCsvButton = (props: ButtonProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  return (
    <>
      <Button
        variant="clear"
        colorScheme="secondary"
        size="xs"
        onClick={onOpen}
        leftIcon={<BiImport />}
        {...props}
      >
        Import
      </Button>
      {/* unmount component when closed to reset all state */}
      {isOpen && (
        <Modal
          isOpen={true}
          onClose={onClose}
          // Prevent closing of modal when import is underway
          closeOnOverlayClick={false}
          closeOnEsc={false}
          motionPreset="none"
        >
          <ModalOverlay />
          <ModalContent>
            <ImportCsvModalContent onClose={onClose} />
          </ModalContent>
        </Modal>
      )}
    </>
  )
}

export default ImportCsvButton

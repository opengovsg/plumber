import { ITableColumnMetadata, ITableMetadata } from '@plumber/types'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BiImport } from 'react-icons/bi'
import { BsCheckCircle, BsPlusCircleFill } from 'react-icons/bs'
import { useLazyQuery, useMutation } from '@apollo/client'
import {
  Box,
  Card,
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

// 2 MB in bytes
const MAX_FILE_SIZE = 2 * 1000 * 1000
// Add row chunk size
const CHUNK_SIZE = 100

const ImportCsvModal = ({ onClose }: { onClose: () => void }) => {
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

  const [importStatus, setImportStatus] = useState<
    'ready' | 'creating columns' | 'importing' | 'completed' | 'error'
  >('creating columns')
  const [rowsToImport, setRowsToImport] = useState(0)
  const [rowsImported, setRowsImported] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [result, setResult] = useState<ValidParseResult | null>(null)
  const [columnsToCreate, setColumnsToCreate] = useState<string[]>([])
  const [matchedColumns, setMatchedColumns] = useState<string[]>([])

  const [file, setFile] = useState<File>()

  const isValidParseResult = useCallback(
    (parseResult: ParseResult<unknown>): parseResult is ValidParseResult => {
      return (
        !!parseResult.meta.fields &&
        parseResult.meta.fields.length > 0 &&
        parseResult.data.length > 0
      )
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
      transformHeader: (header) => header.trim(),
      header: true,
      skipEmptyLines: true,
      complete: (parseResult) => {
        setIsParsing(false)
        if (isValidParseResult(parseResult)) {
          setResult(parseResult)
          const columns = parseResult.meta.fields
          setColumnsToCreate(
            columns.filter((csvColumn) => !columnNamesSet.has(csvColumn)),
          )
          setMatchedColumns(
            columns.filter((csvColumn) => columnNamesSet.has(csvColumn)),
          )
        }
      },
    })
  }, [columnNamesSet, file, isValidParseResult])

  const createNewColumns = useCallback(async () => {
    await createColumns(columnsToCreate)
    const { data: updatedTableData } = await getTableData()
    if (!updatedTableData) {
      throw new Error('Unable to fetch updated table data')
    }
    return updatedTableData.getTable.columns
  }, [columnsToCreate, createColumns, getTableData])

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
    if (!result) {
      return
    }
    try {
      setImportStatus('creating columns')
      let allColumns = tableColumns
      if (columnsToCreate.length > 0) {
        allColumns = await createNewColumns()
      }
      const mappedData = mapDataToColumnIds(allColumns, result.data)
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
            i === chunkedData.length - 1 ? [GET_ALL_ROWS] : undefined,
          awaitRefetchQueries: true,
        })
        setRowsImported((i + 1) * CHUNK_SIZE)
      }
      setImportStatus('completed')
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
    result,
    tableColumns,
    tableId,
  ])

  const importStatusComponent = useMemo(() => {
    switch (importStatus) {
      case 'ready':
        if (!file) {
          return null
        }
        return (
          <>
            {matchedColumns.length > 0 && (
              <>
                <Text color="green.600">
                  {matchedColumns.length} columns matched
                </Text>
                <List spacing={3} my={2}>
                  {matchedColumns.map((field, i) => {
                    return (
                      <Flex key={i} alignItems="center">
                        <ListIcon as={BsCheckCircle} color={'green.500'} />
                        <ListItem>{field}</ListItem>
                      </Flex>
                    )
                  })}
                </List>
              </>
            )}
            {columnsToCreate.length > 0 && (
              <>
                <Text color="primary.600">
                  {columnsToCreate.length} columns will be created
                </Text>
                <List spacing={3} my={2}>
                  {columnsToCreate.map((field, i) => {
                    return (
                      <Flex key={i} alignItems="center">
                        <ListIcon as={BsPlusCircleFill} color={'primary.500'} />
                        <ListItem>{field}</ListItem>
                      </Flex>
                    )
                  })}
                </List>
              </>
            )}
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
            <Progress
              mt={3}
              size="xs"
              value={rowsImported}
              max={rowsToImport}
            />
          </Box>
        )
      case 'completed':
        return (
          <Box>
            <Text>{`${rowsToImport} rows imported`}</Text>
            <Progress mt={3} size="xs" value={100} max={100} />
          </Box>
        )
      case 'error':
        return <Text color="red.500">`Error: ${errorMsg}`</Text>
    }
  }, [
    columnsToCreate,
    errorMsg,
    file,
    importStatus,
    matchedColumns,
    rowsImported,
    rowsToImport,
  ])

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      closeOnOverlayClick={!importStatus}
      motionPreset="none"
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Text textStyle="h6">Import CSV</Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
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
                importStatusComponent
              )}
            </Card>
          )}
        </ModalBody>

        <ModalFooter justifyContent="flex-end">
          {result && (
            <Button
              isLoading={importStatus === 'importing'}
              onClick={importStatus === 'completed' ? onClose : onImport}
            >
              {importStatus === 'completed'
                ? 'Done'
                : `Import ${result.data.length} rows`}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
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
      {isOpen && <ImportCsvModal onClose={onClose} />}
    </>
  )
}

export default ImportCsvButton

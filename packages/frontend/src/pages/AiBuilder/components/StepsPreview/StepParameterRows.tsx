import type { IFieldDropdownOption, IJSONObject } from '@plumber/types'

import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useQuery } from '@apollo/client'
import { Box, Flex, Table, Tbody, Td, Text, Tr } from '@chakra-ui/react'

import {
  buildVariableInfoMapFromPaths,
  substituteOldTemplates,
} from '@/components/RichTextEditor/utils'
import { GET_DYNAMIC_DATA } from '@/graphql/queries/get-dynamic-data'
import { isFieldHidden } from '@/helpers/isFieldHidden'
import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'
import {
  parseParameterValue,
  type Segment,
} from '@/pages/AiBuilder/helpers/parseParameterValue'
import { useStepConfigContext } from '@/pages/AiBuilder/StepConfigContext'

import {
  type ColumnValueRow,
  resolveColumnValueRows,
} from './helpers/columnValueTable'
import {
  collectDynamicFields,
  resolveDynamicSourceVariables,
  withDynamicOptions,
} from './helpers/dynamicFieldOptions'
import {
  getStepFields,
  isRichTextField,
  resolveDisplayValue,
  resolveFieldLabel,
} from './helpers/resolveFieldDisplayValue'
import RichTextPreview from './RichTextPreview'
import VariablePill from './VariablePill'

interface DynamicFieldOptionsFetcherProps {
  stepId: string
  fieldKey: string
  dynamicDataKey: string
  queryParameters: IJSONObject
  onLoaded: (fieldKey: string, options: IFieldDropdownOption[]) => void
}

// Invisible fetcher: one per dynamic field, so each can call useQuery at its
// own component's top level regardless of how many dynamic fields a step has.
function DynamicFieldOptionsFetcher({
  stepId,
  fieldKey,
  dynamicDataKey,
  queryParameters,
  onLoaded,
}: DynamicFieldOptionsFetcherProps) {
  const { data } = useQuery(GET_DYNAMIC_DATA, {
    variables: { stepId, key: dynamicDataKey, parameters: queryParameters },
    skip: !stepId,
    fetchPolicy: 'cache-first',
  })

  const rawOptions = data?.getDynamicData as
    | Array<{ name: string; value: string | number }>
    | undefined
  // Compare by content, not array identity: the JSONObject scalar Apollo
  // hands back on each render isn't guaranteed to be reference-stable even
  // when the underlying cached data hasn't changed, so gate the effect on a
  // content snapshot to avoid re-notifying (and re-rendering the parent) forever.
  const serializedOptions = rawOptions ? JSON.stringify(rawOptions) : undefined

  useEffect(() => {
    if (!serializedOptions) {
      return
    }
    const parsed = JSON.parse(serializedOptions) as Array<{
      name: string
      value: string | number
    }>
    onLoaded(
      fieldKey,
      parsed.map(({ name, value }) => ({ label: name, value })),
    )
  }, [serializedOptions, fieldKey, onLoaded])

  return null
}

interface ParameterValueLineProps {
  line: string
  variableLabelsByPath: Map<string, string>
  variableValuesByPath: Map<string, string>
  stepNameById: Map<string, string>
  // When true, keeps the line on a single row instead of wrapping — used in
  // Column/Value table cells, which handle overflow via scroll instead.
  noWrap?: boolean
}

// Renders one display line: plain text interleaved with VariablePills for
// any `{{step.x.y}}` references. Shared between the plain per-line list and
// each Column/Value table cell.
function ParameterValueLine({
  line,
  variableLabelsByPath,
  variableValuesByPath,
  stepNameById,
  noWrap,
}: ParameterValueLineProps) {
  const segments = parseParameterValue(line)

  return (
    <Box
      as="span"
      fontSize="sm"
      color="base.content.default"
      lineHeight="1.6"
      display="flex"
      flexWrap={noWrap ? 'nowrap' : 'wrap'}
      whiteSpace={noWrap ? 'nowrap' : undefined}
      alignItems="center"
      gap={0.75}
      w={noWrap ? 'max-content' : undefined}
    >
      {segments.map((seg: Segment, i) => {
        if (seg.type === 'text') {
          return <Fragment key={i}>{seg.text}</Fragment>
        }
        const variableKey = `step.${seg.stepId}.${seg.path}`
        return (
          <VariablePill
            key={i}
            label={variableLabelsByPath.get(variableKey) ?? seg.label}
            value={variableValuesByPath.get(variableKey)}
            stepName={stepNameById.get(seg.stepId)}
          />
        )
      })}
    </Box>
  )
}

interface ColumnValueTableProps {
  rows: ColumnValueRow[]
  variableLabelsByPath: Map<string, string>
  variableValuesByPath: Map<string, string>
  stepNameById: Map<string, string>
}

// Renders a multirow/multirow-multicol value (e.g. Tile row data, Excel
// column values) as a Column/Value table instead of a comma-joined line. No
// header — the parameter's own label already reads as the table's caption.
// The Column cell has a fixed width (via tableLayout="fixed") and the Value
// cell scrolls horizontally on its own when its content overflows, instead
// of the whole table scrolling.
function ColumnValueTable({
  rows,
  variableLabelsByPath,
  variableValuesByPath,
  stepNameById,
}: ColumnValueTableProps) {
  return (
    <Table size="sm" variant="simple" sx={{ tableLayout: 'fixed' }} w="full">
      <Tbody>
        {rows.map((row, i) => (
          <Tr key={i}>
            <Td w="35%">{row.column}</Td>
            <Td
              overflowX="auto"
              // Forcefully hide the scrollbar, same as the multirow-multicol
              // input's single-line editor (RichTextEditor.scss), so mouse
              // users don't get a visible scrollbar misaligning row height.
              sx={{ '&::-webkit-scrollbar': { display: 'none' } }}
            >
              <ParameterValueLine
                line={row.value}
                variableLabelsByPath={variableLabelsByPath}
                variableValuesByPath={variableValuesByPath}
                stepNameById={stepNameById}
                noWrap
              />
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  )
}

interface ParameterRowProps {
  label: string
  children: ReactNode
}

// Shared layout for the connection row and each parameter row —
// label stacked above content so long values (e.g. email body) get full width.
function ParameterRow({ label, children }: ParameterRowProps) {
  return (
    <Flex flexDir="column" align="stretch" gap={1} pt={4} pb={2}>
      <Text as="span" textStyle="subhead-3" color="base.content.medium">
        {label}
      </Text>
      {children}
    </Flex>
  )
}

interface StepParameterRowsProps {
  parameters: IJSONObject
  appKey: string
  stepKey: string
  stepId: string
  connectionLabel?: string | null
  stepNameById: Map<string, string>
}

export default function StepParameterRows({
  parameters,
  appKey,
  stepKey,
  stepId,
  connectionLabel,
  stepNameById,
}: StepParameterRowsProps) {
  const { allApps, variableLabelsByPath, variableValuesByPath } =
    useAiBuilderContext()
  const { parameterLabelsByStepId } = useStepConfigContext()
  const parameterLabels = parameterLabelsByStepId[stepId] ?? {}

  const staticStepFields = getStepFields(allApps, appKey, stepKey)
  const dynamicFields = useMemo(
    () => collectDynamicFields(staticStepFields),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allApps, appKey, stepKey],
  )

  const [dynamicOptionsByKey, setDynamicOptionsByKey] = useState<
    Map<string, IFieldDropdownOption[]>
  >(new Map())
  const handleDynamicOptionsLoaded = useCallback(
    (fieldKey: string, options: IFieldDropdownOption[]) => {
      setDynamicOptionsByKey((prev) => {
        if (prev.get(fieldKey) === options) {
          return prev
        }
        const next = new Map(prev)
        next.set(fieldKey, options)
        return next
      })
    },
    [],
  )

  const stepFields = useMemo(
    () => withDynamicOptions(staticStepFields, dynamicOptionsByKey),
    [staticStepFields, dynamicOptionsByKey],
  )

  const dynamicFieldQueries = useMemo(
    () =>
      dynamicFields
        .map(({ fieldKey, source }) => {
          const resolved = resolveDynamicSourceVariables(source, parameters)
          return resolved ? { fieldKey, ...resolved } : null
        })
        .filter(
          (
            query,
          ): query is {
            fieldKey: string
            key: string
            queryParameters: IJSONObject
          } => query !== null,
        ),
    [dynamicFields, parameters],
  )

  const variableInfoMap = useMemo(
    () =>
      buildVariableInfoMapFromPaths(variableLabelsByPath, variableValuesByPath),
    [variableLabelsByPath, variableValuesByPath],
  )

  const fieldIndexMap = new Map(stepFields.map((f, i) => [f.key, i]))
  const rows = Object.entries(parameters)
    .filter(([, value]) => value !== '' && value != null)
    .map(([key, value]) => {
      const field = stepFields.find((f) => f.key === key)
      const hasAiLabel = parameterLabels[key] != null
      // Rich-text fields always show the read-only preview, even over an
      // AI-provided label — raw HTML rendered as text would be unreadable.
      const isPreview = isRichTextField(field)
      return {
        key,
        label: resolveFieldLabel(stepFields, key),
        isPreview,
        previewHtml: isPreview
          ? substituteOldTemplates(String(value), variableInfoMap)
          : undefined,
        // AI-provided labels are already a human-readable summary, so they
        // skip the Column/Value table too. Preview fields skip both, since
        // they render via RichTextPreview instead.
        displayLines: hasAiLabel
          ? [parameterLabels[key]]
          : isPreview
          ? []
          : resolveDisplayValue(stepFields, key, value),
        columnValueRows:
          hasAiLabel || isPreview ? null : resolveColumnValueRows(field, value),
        hiddenIf: field?.hiddenIf,
      }
    })
    .filter(
      ({ displayLines, columnValueRows, hiddenIf, isPreview }) =>
        (isPreview ||
          displayLines.length > 0 ||
          (columnValueRows?.length ?? 0) > 0) &&
        !isFieldHidden(hiddenIf, parameters),
    )
    .sort((a, b) => {
      const posA = fieldIndexMap.get(a.key) ?? Infinity
      const posB = fieldIndexMap.get(b.key) ?? Infinity
      return posA - posB
    })

  if (rows.length === 0 && !connectionLabel) {
    return null
  }

  return (
    <>
      {dynamicFieldQueries.map(({ fieldKey, key, queryParameters }) => (
        <DynamicFieldOptionsFetcher
          key={fieldKey}
          stepId={stepId}
          fieldKey={fieldKey}
          dynamicDataKey={key}
          queryParameters={queryParameters}
          onLoaded={handleDynamicOptionsLoaded}
        />
      ))}
      <Box
        pt={1}
        pb={3}
        px={6}
        borderTop="1px solid"
        borderColor="base.divider.medium"
      >
        {connectionLabel && (
          <ParameterRow label="Connection">
            <Text as="span" fontSize="sm" color="base.content.default">
              {connectionLabel}
            </Text>
          </ParameterRow>
        )}
        {rows.map(
          ({
            key,
            label,
            displayLines,
            columnValueRows,
            isPreview,
            previewHtml,
          }) => (
            <ParameterRow key={key} label={label}>
              {isPreview ? (
                <RichTextPreview
                  html={previewHtml ?? ''}
                  stepNameById={stepNameById}
                />
              ) : columnValueRows && columnValueRows.length > 0 ? (
                <ColumnValueTable
                  rows={columnValueRows}
                  variableLabelsByPath={variableLabelsByPath}
                  variableValuesByPath={variableValuesByPath}
                  stepNameById={stepNameById}
                />
              ) : (
                <Flex direction="column" gap={1}>
                  {displayLines.map((line, lineIndex) => (
                    <ParameterValueLine
                      key={lineIndex}
                      line={line}
                      variableLabelsByPath={variableLabelsByPath}
                      variableValuesByPath={variableValuesByPath}
                      stepNameById={stepNameById}
                    />
                  ))}
                </Flex>
              )}
            </ParameterRow>
          ),
        )}
      </Box>
    </>
  )
}

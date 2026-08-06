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
import { Box, Flex, Text } from '@chakra-ui/react'

import { GET_DYNAMIC_DATA } from '@/graphql/queries/get-dynamic-data'
import { isFieldHidden } from '@/helpers/isFieldHidden'
import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'
import { parseParameterValue } from '@/pages/AiBuilder/helpers/parseParameterValue'
import { useStepConfigContext } from '@/pages/AiBuilder/StepConfigContext'

import {
  collectDynamicFields,
  resolveDynamicSourceVariables,
  withDynamicOptions,
} from './helpers/dynamicFieldOptions'
import {
  getStepFields,
  resolveDisplayValue,
  resolveFieldLabel,
} from './helpers/resolveFieldDisplayValue'
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

interface ParameterRowProps {
  label: string
  children: ReactNode
}

// Shared row layout for both the connection row and each parameter row —
// keeps the label column (width, alignment, styling) in one place.
function ParameterRow({ label, children }: ParameterRowProps) {
  return (
    <Flex align="flex-start" gap={4} py={2}>
      <Text
        as="span"
        display="inline-block"
        fontSize="sm"
        color="base.content.medium"
        fontWeight={500}
        w="80px"
        flexShrink={0}
      >
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

  const fieldIndexMap = new Map(stepFields.map((f, i) => [f.key, i]))
  const rows = Object.entries(parameters)
    .filter(([, value]) => value !== '' && value != null)
    .map(([key, value]) => {
      const field = stepFields.find((f) => f.key === key)
      return {
        key,
        label: resolveFieldLabel(stepFields, key),
        // AI-provided labels take priority over static option resolution
        displayLines:
          parameterLabels[key] != null
            ? [parameterLabels[key]]
            : resolveDisplayValue(stepFields, key, value),
        hiddenIf: field?.hiddenIf,
      }
    })
    .filter(
      ({ displayLines, hiddenIf }) =>
        displayLines.length > 0 && !isFieldHidden(hiddenIf, parameters),
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
        pl="58px"
        pr={4}
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
        {rows.map(({ key, label, displayLines }) => (
          <ParameterRow key={key} label={label}>
            <Flex direction="column" gap={1}>
              {displayLines.map((line, lineIndex) => {
                const segments = parseParameterValue(line)

                return (
                  <Box
                    key={lineIndex}
                    as="span"
                    fontSize="sm"
                    color="base.content.default"
                    lineHeight="1.6"
                    display="flex"
                    flexWrap="wrap"
                    alignItems="center"
                    gap={0.75}
                  >
                    {segments.map((seg, i) => {
                      if (seg.type === 'text') {
                        return <Fragment key={i}>{seg.text}</Fragment>
                      }
                      const variableKey = `step.${seg.stepId}.${seg.path}`
                      return (
                        <VariablePill
                          key={i}
                          label={
                            variableLabelsByPath.get(variableKey) ?? seg.label
                          }
                          value={variableValuesByPath.get(variableKey)}
                          stepName={stepNameById.get(seg.stepId)}
                        />
                      )
                    })}
                  </Box>
                )
              })}
            </Flex>
          </ParameterRow>
        ))}
      </Box>
    </>
  )
}

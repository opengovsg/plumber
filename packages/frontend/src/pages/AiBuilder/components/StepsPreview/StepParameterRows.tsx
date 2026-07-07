import type { IApp, IJSONObject } from '@plumber/types'

import { Fragment } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'

import { isFieldHidden } from '@/helpers/isFieldHidden'
import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'
import { parseParameterValue } from '@/pages/AiBuilder/helpers/parseParameterValue'
import { useStepConfigContext } from '@/pages/AiBuilder/StepConfigContext'

import VariablePill from './VariablePill'

function camelToSentence(key: string): string {
  const words = key.replace(/([A-Z])/g, ' $1').trim()
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase()
}

function getStepFields(allApps: IApp[], appKey: string, stepKey: string) {
  const app = allApps.find((a) => a.key === appKey)
  if (!app) {
    return []
  }
  const trigger = app.triggers?.find((t) => t.key === stepKey)
  const action = app.actions?.find((a) => a.key === stepKey)
  return [
    ...(trigger?.substeps?.flatMap((s) => s.arguments ?? []) ?? []),
    ...(action?.substeps?.flatMap((s) => s.arguments ?? []) ?? []),
  ]
}

function resolveFieldLabel(
  allApps: IApp[],
  appKey: string,
  stepKey: string,
  paramKey: string,
): string {
  const fields = getStepFields(allApps, appKey, stepKey)
  return (
    fields.find((f) => f.key === paramKey)?.label ?? camelToSentence(paramKey)
  )
}

type FieldWithOptions = {
  options?: Array<{ label: string; value: string | number }>
  subFields?: FieldWithOptions[]
}

// Resolve a single scalar value against a field's option list.
function resolveOptionLabel(
  field: FieldWithOptions | undefined,
  strValue: string,
): string {
  const option = field?.options?.find((o) => String(o.value) === strValue)
  return option ? option.label : strValue
}

// Recursively flatten object/array values into a readable string,
// resolving option labels from subField definitions where available.
function flattenValue(
  value: unknown,
  subFields?: FieldWithOptions[],
): string | null {
  if (Array.isArray(value)) {
    // Array of rows (e.g. multirow-multicol): join each row with ', '
    const rows = value
      .map((item) => flattenValue(item, subFields))
      .filter(Boolean)
    return rows.length > 0 ? rows.join(', ') : null
  }

  if (typeof value === 'object' && value !== null) {
    // Object row: resolve each key against its subField options, join with ' '
    const parts = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== '' && v != null)
      .map(([k, v]) => {
        const subField = subFields?.find(
          (f) => (f as unknown as { key?: string }).key === k,
        )
        return resolveOptionLabel(subField, String(v))
      })
    return parts.length > 0 ? parts.join(' ') : null
  }

  return String(value)
}

function resolveDisplayValue(
  allApps: IApp[],
  appKey: string,
  stepKey: string,
  paramKey: string,
  value: unknown,
): string | null {
  const fields = getStepFields(allApps, appKey, stepKey)
  const field = fields.find((f) => f.key === paramKey) as
    | FieldWithOptions
    | undefined

  // For objects/arrays (e.g. multirow-multicol), recursively flatten with sub-field label resolution
  if (typeof value === 'object' && value !== null) {
    return flattenValue(value, field?.subFields)
  }

  // For scalar values, resolve option label if the field has static options
  return resolveOptionLabel(field, String(value))
}

interface StepParameterRowsProps {
  parameters: IJSONObject
  appKey: string
  stepKey: string
  stepId: string
}

export default function StepParameterRows({
  parameters,
  appKey,
  stepKey,
  stepId,
}: StepParameterRowsProps) {
  const { allApps } = useAiBuilderContext()
  const { parameterLabelsByStepId } = useStepConfigContext()
  const parameterLabels = parameterLabelsByStepId[stepId] ?? {}

  const stepFields = getStepFields(allApps, appKey, stepKey)
  const rows = Object.entries(parameters)
    .filter(([, value]) => value !== '' && value != null)
    .map(([key, value]) => {
      const field = stepFields.find((f) => f.key === key)
      return {
        key,
        label: resolveFieldLabel(allApps, appKey, stepKey, key),
        // AI-provided labels take priority over static option resolution
        displayValue:
          parameterLabels[key] ??
          resolveDisplayValue(allApps, appKey, stepKey, key, value),
        hiddenIf: field?.hiddenIf,
      }
    })
    .filter(
      ({ displayValue, hiddenIf }) =>
        displayValue !== null &&
        displayValue !== '' &&
        !isFieldHidden(hiddenIf, parameters),
    )

  if (rows.length === 0) {
    return null
  }

  return (
    <Box
      pt={1}
      pb={3}
      pl="58px"
      pr={4}
      borderTop="1px solid"
      borderColor="base.divider.medium"
    >
      {rows.map(({ key, label, displayValue }) => {
        const segments = parseParameterValue(displayValue as string)

        return (
          <Flex key={key} align="center" gap={2.5} py="5px">
            <Text
              as="span"
              fontSize="12px"
              color="base.content.medium"
              fontWeight={500}
              minW="54px"
              flexShrink={0}
            >
              {label}
            </Text>
            <Box
              as="span"
              fontSize="13px"
              color="base.content.default"
              lineHeight="1.6"
              display="flex"
              flexWrap="wrap"
              alignItems="center"
              gap={0.75}
            >
              {segments.map((seg, i) =>
                seg.type === 'text' ? (
                  // eslint-disable-next-line react/no-array-index-key
                  <Fragment key={i}>{seg.text}</Fragment>
                ) : (
                  // eslint-disable-next-line react/no-array-index-key
                  <VariablePill key={i} label={seg.label} />
                ),
              )}
            </Box>
          </Flex>
        )
      })}
    </Box>
  )
}

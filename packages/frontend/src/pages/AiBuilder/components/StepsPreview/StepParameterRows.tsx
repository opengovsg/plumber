import type { IApp, IJSONObject } from '@plumber/types'

import { Fragment, type ReactNode } from 'react'
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
  fields: ReturnType<typeof getStepFields>,
  paramKey: string,
): string {
  return (
    fields.find((f) => f.key === paramKey)?.label ?? camelToSentence(paramKey)
  )
}

type FieldWithOptions = {
  key?: string
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
    const obj = value as Record<string, unknown>
    // Follow subField definition order if available; otherwise use object key order
    const keys = subFields
      ? subFields
          .map((f) => f.key)
          .filter((k): k is string => k != null && k in obj)
      : Object.keys(obj)
    const parts = keys
      .filter((k) => obj[k] !== '' && obj[k] != null)
      .map((k) => {
        const subField = subFields?.find((f) => f.key === k)
        // obj[k] is assumed scalar here: no current app schema nests a
        // multirow/multirow-multicol subField inside another one's subFields,
        // even though IField's type allows it. If that ever changes, this
        // needs a typeof-object branch that recurses into flattenValue
        // instead of stringifying — see PR #1864 review discussion.
        return resolveOptionLabel(subField, String(obj[k]))
      })
    return parts.length > 0 ? parts.join(' ') : null
  }

  return String(value)
}

function resolveDisplayValue(
  fields: ReturnType<typeof getStepFields>,
  paramKey: string,
  value: unknown,
): string | null {
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

  const stepFields = getStepFields(allApps, appKey, stepKey)
  const fieldIndexMap = new Map(stepFields.map((f, i) => [f.key, i]))
  const rows = Object.entries(parameters)
    .filter(([, value]) => value !== '' && value != null)
    .map(([key, value]) => {
      const field = stepFields.find((f) => f.key === key)
      return {
        key,
        label: resolveFieldLabel(stepFields, key),
        // AI-provided labels take priority over static option resolution
        displayValue:
          parameterLabels[key] ?? resolveDisplayValue(stepFields, key, value),
        hiddenIf: field?.hiddenIf,
      }
    })
    .filter(
      ({ displayValue, hiddenIf }) =>
        displayValue !== null &&
        displayValue !== '' &&
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
      {rows.map(({ key, label, displayValue }) => {
        const segments = parseParameterValue(displayValue as string)

        return (
          <ParameterRow key={key} label={label}>
            <Box
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
                  // eslint-disable-next-line react/no-array-index-key
                  return <Fragment key={i}>{seg.text}</Fragment>
                }
                const variableKey = `step.${seg.stepId}.${seg.path}`
                return (
                  // eslint-disable-next-line react/no-array-index-key
                  <VariablePill
                    key={i}
                    label={variableLabelsByPath.get(variableKey) ?? seg.label}
                    value={variableValuesByPath.get(variableKey)}
                    stepName={stepNameById.get(seg.stepId)}
                  />
                )
              })}
            </Box>
          </ParameterRow>
        )
      })}
    </Box>
  )
}

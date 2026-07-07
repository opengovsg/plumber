import type { IApp, IFieldDropdown, IJSONObject } from '@plumber/types'

import { Fragment } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'

import { isFieldHidden } from '@/helpers/isFieldHidden'
import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'
import { parseParameterValue } from '@/pages/AiBuilder/helpers/parseParameterValue'

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

function resolveDisplayValue(
  allApps: IApp[],
  appKey: string,
  stepKey: string,
  paramKey: string,
  value: unknown,
): string | null {
  // Skip object/array values — they can't be displayed meaningfully as a flat string
  if (typeof value === 'object' && value !== null) {
    return null
  }

  const strValue = String(value)

  // For dropdown fields with static options, show the option label not the raw key
  const fields = getStepFields(allApps, appKey, stepKey)
  const field = fields.find((f) => f.key === paramKey)
  if (field?.type === 'dropdown') {
    const option = (field as IFieldDropdown).options?.find(
      (o) => String(o.value) === strValue,
    )
    if (option) {
      return option.label
    }
  }

  return strValue
}

interface StepParameterRowsProps {
  parameters: IJSONObject
  appKey: string
  stepKey: string
}

export default function StepParameterRows({
  parameters,
  appKey,
  stepKey,
}: StepParameterRowsProps) {
  const { allApps } = useAiBuilderContext()

  const stepFields = getStepFields(allApps, appKey, stepKey)
  const rows = Object.entries(parameters)
    .filter(([, value]) => value !== '' && value != null)
    .map(([key, value]) => {
      const field = stepFields.find((f) => f.key === key)
      return {
        key,
        label: resolveFieldLabel(allApps, appKey, stepKey, key),
        displayValue: resolveDisplayValue(allApps, appKey, stepKey, key, value),
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
      borderColor="base.divider.weak"
    >
      {rows.map(({ key, label, displayValue }, rowIndex) => {
        const segments = parseParameterValue(displayValue as string)

        return (
          <Flex
            key={key}
            align="center"
            gap={2.5}
            py="5px"
            borderBottom={rowIndex < rows.length - 1 ? '1px solid' : 'none'}
            borderColor="base.divider.weak"
          >
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

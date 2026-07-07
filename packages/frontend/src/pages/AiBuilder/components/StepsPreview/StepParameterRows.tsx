import type { IApp, IJSONObject } from '@plumber/types'

import { Fragment } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'

import { useAiBuilderContext } from '@/pages/AiBuilder/AiBuilderContext'
import { parseParameterValue } from '@/pages/AiBuilder/helpers/parseParameterValue'

import VariablePill from './VariablePill'

const HIDDEN_KEYS = new Set(['depth', 'branchName'])

function camelToSentence(key: string): string {
  const words = key.replace(/([A-Z])/g, ' $1').trim()
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase()
}

function resolveFieldLabel(
  allApps: IApp[],
  appKey: string,
  stepKey: string,
  paramKey: string,
): string {
  const app = allApps.find((a) => a.key === appKey)
  if (!app) return camelToSentence(paramKey)

  const trigger = app.triggers?.find((t) => t.key === stepKey)
  const action = app.actions?.find((a) => a.key === stepKey)
  const fields = [
    ...(trigger?.substeps?.flatMap((s) => s.arguments ?? []) ?? []),
    ...(action?.substeps?.flatMap((s) => s.arguments ?? []) ?? []),
  ]

  return fields.find((f) => f.key === paramKey)?.label ?? camelToSentence(paramKey)
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

  const rows = Object.entries(parameters).filter(
    ([key, value]) => !HIDDEN_KEYS.has(key) && value !== '' && value != null,
  )

  if (rows.length === 0) return null

  return (
    <Box
      pt={1}
      pb={3}
      pl="58px"
      pr={4}
      borderTop="1px solid"
      borderColor="base.divider.weak"
    >
      {rows.map(([key, value], rowIndex) => {
        const label = resolveFieldLabel(allApps, appKey, stepKey, key)
        const strValue = String(value)
        const segments = parseParameterValue(strValue)

        return (
          <Flex
            key={key}
            align="baseline"
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

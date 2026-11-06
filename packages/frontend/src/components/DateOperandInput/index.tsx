import { Box, Flex, Text } from '@chakra-ui/react'
import { Button, FormLabel } from '@opengovsg/design-system-react'
import type { IField, IFieldDateOperand } from '@plumber/types'
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

import InputCreator, { InputCreatorProps } from '@/components/InputCreator'
import { simpleSubstitute } from '@/components/RichTextEditor/utils'
import { EditorContext } from '@/contexts/Editor'
import { detectDateFormat } from '@/helpers/detectDateFormat'

type DateOperandInputProps = {
  schema: IFieldDateOperand
} & Pick<InputCreatorProps, 'namePrefix' | 'stepId'>

/**
 * A date and its format as one field. Users enter the date first, and the
 * format is picked for them from what they typed or selected. "Now" is a time
 * and not a format, so it is a shortcut under the date instead of a format.
 */
export default function DateOperandInput(
  props: DateOperandInputProps,
): JSX.Element {
  const { schema, namePrefix, stepId } = props
  const {
    label,
    required,
    valueKey,
    formatKey,
    nowValue,
    formatOptions,
    valuePlaceholder,
  } = schema
  const { control, setValue } = useFormContext()
  const { readOnly, varInfoMap, isMobile } = useContext(EditorContext)

  const prefix = namePrefix ? `${namePrefix}.` : ''
  const valuePath = `${prefix}${valueKey}`
  const formatPath = `${prefix}${formatKey}`
  const dateValue = useWatch({ name: valuePath, control }) as string | undefined
  const format = useWatch({ name: formatPath, control }) as string | undefined
  const isNow = format === nowValue

  // The sample of a picked variable is what decides the format, so variables
  // are replaced by their test values before detecting.
  const detectedFormat = useMemo(() => {
    if (!dateValue) {
      return undefined
    }
    const sample = simpleSubstitute(dateValue, varInfoMap).replace(
      /<[^>]*>/g,
      '',
    )
    return detectDateFormat(sample)
  }, [dateValue, varInfoMap])

  // Only formats this field filled in itself are replaced, so a format the user
  // chose stays.
  const lastDetected = useRef<string>()
  useEffect(() => {
    if (readOnly || isNow || !detectedFormat) {
      return
    }
    if (format && format !== lastDetected.current) {
      return
    }
    lastDetected.current = detectedFormat
    if (format !== detectedFormat) {
      setValue(formatPath, detectedFormat, {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }, [detectedFormat, format, isNow, readOnly, formatPath, setValue])

  const setFormat = useCallback(
    (value: string) => {
      setValue(formatPath, value, { shouldDirty: true, shouldValidate: true })
    },
    [setValue, formatPath],
  )

  const selectNow = useCallback(() => {
    setValue(valuePath, '', { shouldDirty: true })
    setFormat(nowValue)
  }, [setValue, valuePath, setFormat, nowValue])

  const hasDate = !!dateValue?.replace(/<[^>]*>/g, '').trim()

  const valueSchema: IField = {
    key: valueKey,
    type: 'string',
    required: true,
    variables: true,
    placeholder: valuePlaceholder,
  }
  const formatSchema: IField = {
    key: formatKey,
    placeholder: hasDate ? 'Format' : 'Add the date first',
    // The date decides the format, so it comes first.
    readOnly: !hasDate,
    type: 'dropdown',
    required: true,
    variables: false,
    showOptionValue: false,
    options: formatOptions,
  }

  return (
    <Flex flexDir="column" gap={2}>
      <Flex alignItems="center" justifyContent="space-between" gap={3}>
        <FormLabel isRequired={required} mb={0}>
          {label}
        </FormLabel>
        {!isNow && (
          <Button
            variant="link"
            size="xs"
            flexShrink={0}
            isDisabled={readOnly}
            onClick={selectNow}
          >
            Use current date and time (SG)
          </Button>
        )}
      </Flex>

      {isNow ? (
        <Flex
          alignItems="center"
          justifyContent="space-between"
          gap={3}
          minH="44px"
          px={4}
          borderRadius="4px"
          bg="secondary.50"
        >
          <Flex flexDir="column">
            <Text textStyle="subhead-2" color="base.content.strong">
              Now
            </Text>
            <Text textStyle="caption-2" color="base.content.medium">
              The current date and time in Singapore when this step runs
            </Text>
          </Flex>
          <Button
            variant="link"
            size="xs"
            isDisabled={readOnly}
            onClick={() => {
              lastDetected.current = undefined
              setFormat('')
            }}
          >
            Change
          </Button>
        </Flex>
      ) : (
        <Flex flexDir={isMobile ? 'column' : 'row'} gap={2}>
          <Box flex={isMobile ? undefined : 3} minW={0}>
            <InputCreator
              schema={valueSchema}
              namePrefix={namePrefix}
              stepId={stepId}
            />
          </Box>
          <Box flex={isMobile ? undefined : 2} minW={0}>
            <InputCreator
              schema={formatSchema}
              namePrefix={namePrefix}
              stepId={stepId}
            />
          </Box>
        </Flex>
      )}
    </Flex>
  )
}

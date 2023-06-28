import type { IField, IFieldDropdownSource, IJSONObject } from '@plumber/types'

import * as React from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useFormContext } from 'react-hook-form'
import { useLazyQuery } from '@apollo/client'
import { GET_DYNAMIC_DATA } from 'graphql/queries/get-dynamic-data'
import isEqual from 'lodash/isEqual'
import set from 'lodash/set'

const variableRegExp = /({.*?})/g

function computeArguments(
  args: IFieldDropdownSource['arguments'],
  getValues: UseFormReturn['getValues'],
): IJSONObject {
  const initialValue = {}
  return args.reduce((result, { name, value }) => {
    const isVariable = variableRegExp.test(value)

    if (isVariable) {
      const sanitizedFieldPath = value.replace(/{|}/g, '')
      const computedValue = getValues(sanitizedFieldPath)

      if (computedValue === undefined) {
        throw new Error(`The ${sanitizedFieldPath} field is required.`)
      }

      set(result, name, computedValue)

      return result
    }

    set(result, name, value)

    return result
  }, initialValue)
}

/**
 * Fetch the dynamic data for the given step.
 * This hook must be within a react-hook-form context.
 *
 * @param stepId - the id of the step
 * @param schema - the field that needs the dynamic data
 */
function useDynamicData(stepId: string | undefined, schema: IField) {
  const lastComputedVariables = React.useRef({})
  const [getDynamicData, { called, data, loading, refetch }] =
    useLazyQuery(GET_DYNAMIC_DATA)
  const { getValues } = useFormContext()
  const formValues = getValues()

  /**
   * Return `null` when even a field is missing value.
   *
   * This must return the same reference if no computed variable is changed.
   * Otherwise, it causes redundant network request!
   */
  const computedVariables = React.useMemo(() => {
    if (schema.type === 'dropdown' && schema.source) {
      try {
        const variables = computeArguments(schema.source.arguments, getValues)

        // if computed variables are the same, return the last computed variables.
        if (isEqual(variables, lastComputedVariables.current)) {
          return lastComputedVariables.current
        }

        lastComputedVariables.current = variables

        return variables
      } catch (err) {
        return null
      }
    }

    return null
    /**
     * `formValues` is to trigger recomputation when form is updated.
     * `getValues` is for convenience as it supports paths for fields like `getValues('foo.bar.baz')`.
     */
  }, [schema, formValues, getValues])

  React.useEffect(() => {
    if (
      schema.type === 'dropdown' &&
      stepId &&
      schema.source &&
      computedVariables
    ) {
      getDynamicData({
        variables: {
          stepId,
          ...computedVariables,
        },
      })
    }
  }, [getDynamicData, stepId, schema, computedVariables])

  return {
    called,
    data: data?.getDynamicData,
    loading,
    refetch,
  }
}

export default useDynamicData

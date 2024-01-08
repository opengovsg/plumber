import type { IField, IFieldDropdownSource } from '@plumber/types'

import { useEffect, useMemo } from 'react'
import { type FieldValues, useFormContext } from 'react-hook-form'
import { useQuery } from '@apollo/client'
import { GET_DYNAMIC_DATA } from 'graphql/queries/get-dynamic-data'
import { get, set } from 'lodash'

/**
 * Map of field path -> argument name
 */
type WatchedFormFields = ReadonlyMap<string, string>

function processArguments(args: IFieldDropdownSource['arguments']): {
  nonFormFieldArgs: Readonly<Record<string, string>>
  watchedFormFields: WatchedFormFields
} {
  const nonFormFieldArgs: Record<string, string> = Object.create(null)
  const watchedFormFields = new Map()

  for (const arg of args) {
    const { name, value } = arg

    const isVariable = value.startsWith('{') && value.endsWith('}')
    if (isVariable) {
      const fieldPath = value.slice(1, value.length - 1)
      watchedFormFields.set(fieldPath, name)
    } else {
      nonFormFieldArgs[name] = value
    }
  }

  return { nonFormFieldArgs, watchedFormFields }
}

function getWatchedFormFieldValues(
  watchedFormFields: WatchedFormFields,
  formFieldValues: FieldValues,
): Readonly<Record<string, string>> {
  const result: Record<string, string> = Object.create(null)

  for (const [fieldPath, argumentName] of watchedFormFields.entries()) {
    const value = get(formFieldValues, fieldPath)
    if (value) {
      set(result, argumentName, value)
    }
  }

  return result
}

/**
 * Fetch the dynamic data for the given step.
 * This hook must be within a react-hook-form context.
 *
 * @param stepId - the id of the step
 * @param schema - the field that needs the dynamic data
 */
function useDynamicData(stepId: string | undefined, schema: IField) {
  const { getValues, watch } = useFormContext()
  const { nonFormFieldArgs, watchedFormFields } = useMemo(() => {
    if (schema.type !== 'dropdown' || !schema.source) {
      return {
        nonFormFieldArgs: {},
        watchedFormFields: new Map(),
      }
    }

    return processArguments(schema.source.arguments)
  }, [schema])
  const watchedFormFieldValues = useMemo(
    () => getWatchedFormFieldValues(watchedFormFields, getValues()),
    [
      watchedFormFields,
      // We depend on getValues instead of its result, because we don't want to
      // re-query each time a form value changes. Instead, we use watch (below)
      // on the fields we're interested in.
      getValues,
    ],
  )

  const shouldSkipQuery =
    !stepId || schema.type !== 'dropdown' || !schema.source
  const { called, data, loading, refetch } = useQuery(GET_DYNAMIC_DATA, {
    variables: {
      stepId,
      ...nonFormFieldArgs,
      ...watchedFormFieldValues,
    },
    skip: shouldSkipQuery,
    notifyOnNetworkStatusChange: true,
  })

  // Refetch if any of our watched form fields changes.
  useEffect(() => {
    if (watchedFormFields.size === 0) {
      return
    }

    const watchSubscription = watch(
      (newFieldValues, { name: fieldPath, type }) => {
        if (
          !fieldPath ||
          !type ||
          type !== 'change' ||
          !watchedFormFields.has(fieldPath)
        ) {
          return
        }

        refetch({
          ...getWatchedFormFieldValues(watchedFormFields, newFieldValues),
        })
      },
    )

    return () => watchSubscription.unsubscribe()
  }, [refetch, watch, watchedFormFields])

  return {
    called,
    data: data?.getDynamicData,
    loading,
    refetch,
  }
}

export default useDynamicData

import {
  IField,
  IJSONObject,
  IJSONValue,
  IStep,
  ISubstep,
} from '@plumber/types'

import { yupResolver } from '@hookform/resolvers/yup'
import type { BaseSchema } from 'yup'
import * as yup from 'yup'
import type { ObjectShape } from 'yup/lib/object'

import { isFieldHidden } from '@/helpers/isFieldHidden'

export const getFlowStepHeaderWidth = (
  isDrawerOpen: boolean,
  isMobile?: boolean,
  isNested?: boolean,
) => {
  if (isDrawerOpen) {
    if (isMobile) {
      return '0px'
    }
    return '100%'
  }

  if (isMobile) {
    return '100%'
  }

  return isNested ? 'full' : '55%'
}

function isValidArgValue(value: IJSONValue): boolean {
  // `false` and 0 are valid values, only null, undefined and empty string are invalid
  return value != null && value !== ''
}

export function validateSubstep(substep: ISubstep, step: IStep): boolean {
  if (!substep) {
    return true
  }

  const args: IField[] = substep.arguments || []

  return args.every((arg) => {
    if (
      arg.required === false ||
      isFieldHidden(arg.hiddenIf, step.parameters)
    ) {
      return true
    }

    // Edge case: multirow doesn't have a value; it has nested fields instead.
    if (arg.type === 'multirow') {
      const rows = (step.parameters[arg.key] ?? []) as IJSONObject[]
      if (rows.length === 0) {
        return false
      }

      //
      // For each required subfield in the multirow, check that every row has a
      // value for it.
      //
      for (const subField of arg.subFields) {
        // Ignore optional subfield
        // (required is true by default, so we strict equality against false)
        if (subField.required === false) {
          continue
        }

        for (const row of rows) {
          // Ignore subfield if it's hidden in this particular row
          if (isFieldHidden(subField.hiddenIf, row)) {
            continue
          }

          if (!isValidArgValue(row[subField.key])) {
            return false
          }
        }
      }

      return true
    }

    return isValidArgValue(step.parameters[arg.key])
  })
}

// FIXME (ogp-weeloong): remove this; not needed since we already do validation in FlowSubstep.
export function generateValidationSchema(substeps: ISubstep[]) {
  const fieldValidations = substeps?.reduce(
    (allValidations, { arguments: args }) => {
      if (!args || !Array.isArray(args)) {
        return allValidations
      }

      const substepArgumentValidations: Record<string, BaseSchema> = {}

      for (const arg of args) {
        const { key, required, hiddenIf } = arg

        // base validation for the field if not exists
        if (!substepArgumentValidations[key]) {
          substepArgumentValidations[key] = yup.mixed()
        }

        if (typeof substepArgumentValidations[key] === 'object') {
          // if the field is required and not conditionally hidden, add the
          // required validation
          if (required && !hiddenIf) {
            substepArgumentValidations[key] = substepArgumentValidations[
              key
            ].required(`${key} is required.`)
          }
        }
      }

      return {
        ...allValidations,
        ...substepArgumentValidations,
      }
    },
    {} as ObjectShape,
  )

  const validationSchema = yup.object({
    parameters: yup.object(fieldValidations),
  })

  return yupResolver(validationSchema)
}

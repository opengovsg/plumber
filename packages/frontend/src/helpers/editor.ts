import { yupResolver } from '@hookform/resolvers/yup'
import {
  IField,
  IJSONObject,
  IJSONValue,
  IStep,
  ISubstep,
} from '@plumber/types'
import { FieldValues, UseFormReturn } from 'react-hook-form'
import { BiQuestionMark } from 'react-icons/bi'
import type { BaseSchema } from 'yup'
import * as yup from 'yup'
import type { ObjectShape } from 'yup/lib/object'

import { TOOLBOX_ACTION_TO_ICON_MAP } from '@/components/FlowStepConfigurationModal/ChooseAppAndEvent/ToolboxEvent'
import { getInputFlag } from '@/config/flags'
import type { LaunchDarklyContextData } from '@/contexts/LaunchDarkly'
import {
  areRowsComplete,
  isGroupedMultiRowComplete,
} from '@/helpers/grouped-multirow-validation'
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

  return isNested ? 'full' : '600px'
}

function isValidArgValue(value: IJSONValue): boolean {
  // `false` and 0 are valid values, only null, undefined and empty string are invalid
  return value != null && value !== ''
}

// Input flags gate a field's rollout by the step's creation time: the field
// only shows for steps created after the flag's configured timestamp.
export function isInputVisibleForStep(
  actionOrTriggerKey: string | undefined,
  argKey: string,
  stepCreatedAt: string | number,
  getFlagValue: LaunchDarklyContextData['getFlagValue'],
): boolean {
  const inputFlag = getInputFlag(actionOrTriggerKey ?? '', argKey)
  const flagValue = getFlagValue(inputFlag, false)
  return !flagValue || +stepCreatedAt <= flagValue
}

// Field definitions can specify a static `value` to pre-select (e.g. a
// boolean-radio defaulting to "No"). That default only reaches react-hook-form
// via each input's own `defaultValue` prop, which registers asynchronously
// after mount — too late for validation that runs on the form's initial
// render (see FlowSubstep's initial `isValid` state). Backfilling here, into
// the `defaultValues` passed to `useForm`, makes the default available
// synchronously from the very first render.
export function withDefaultParameters(
  step: IStep,
  substeps: ISubstep[],
  actionOrTriggerKey: string | undefined,
  getFlagValue: LaunchDarklyContextData['getFlagValue'],
): IStep {
  const defaultParameters: IJSONObject = {}

  for (const substep of substeps ?? []) {
    for (const arg of substep.arguments ?? []) {
      if (arg.value === undefined || step.parameters[arg.key] !== undefined) {
        continue
      }

      // Skip fields hidden behind a not-yet-active input flag: seeding their
      // default here would make the form report a value the user never saw
      // and the backend never received, desyncing it from `dataIn`.
      if (
        !isInputVisibleForStep(
          actionOrTriggerKey,
          arg.key,
          step.createdAt,
          getFlagValue,
        )
      ) {
        continue
      }

      defaultParameters[arg.key] = arg.value as IJSONValue
    }
  }

  if (Object.keys(defaultParameters).length === 0) {
    return step
  }

  return {
    ...step,
    parameters: {
      ...defaultParameters,
      ...step.parameters,
    },
  }
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
    // Every row must have all required subfields filled.
    if (arg.type === 'multirow') {
      const rows = (step.parameters[arg.key] ?? []) as IJSONObject[]
      return areRowsComplete(rows, arg.subFields)
    }

    // grouped-multirow: every OR-group must have >=1 complete row (i.e. be
    // non-empty with all its rows complete). The `empty`-operator value field is
    // skipped per row via its `hiddenIf`.
    if (arg.type === 'grouped-multirow') {
      const groups = (step.parameters[arg.key] ?? []) as {
        rows?: IJSONObject[]
      }[]
      return isGroupedMultiRowComplete(groups, arg.subFields)
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

export function getToolboxIcon(key?: string | null) {
  if (!key) {
    return BiQuestionMark
  }

  return (
    TOOLBOX_ACTION_TO_ICON_MAP[
      key as keyof typeof TOOLBOX_ACTION_TO_ICON_MAP
    ] ?? BiQuestionMark
  )
}

// NOTE: check if any fields are dirty recursively
// there may be arrays added for multirow inputs that have been deleted
// and still reside as empty objects in dirtyFields
export const hasDirtyFields = (fields: Record<string, any>): boolean => {
  return Object.entries(fields).some(([_, value]) => {
    // If value is true, the field is dirty
    if (value === true) {
      return true
    }
    // If value is an object (including arrays), recurse
    if (value && typeof value === 'object') {
      return hasDirtyFields(value)
    }
    return false
  })
}

export function getDefaultValue(
  formContext: UseFormReturn<FieldValues, any, FieldValues>,
  defaultValue?:
    | string
    | { fieldKey: string; options: Record<string, string | IJSONValue> }
    | undefined,
): string | IJSONValue | undefined {
  if (!defaultValue) {
    return undefined
  }

  if (typeof defaultValue === 'string') {
    return defaultValue
  }

  const formValues = formContext.getValues()
  const fieldValue = formValues.parameters[defaultValue.fieldKey]
  return defaultValue.options[fieldValue] ?? undefined
}

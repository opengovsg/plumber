import type {
  IField,
  IFieldDropdownOption,
  IGlobalVariable,
  IRawAction,
} from '@plumber/types'

type TransformFunction = (
  $: IGlobalVariable,
  valueToTransform: string,
) => ReturnType<IRawAction['run']>

/**
 * Helper object for transforms to describe themselves.
 */
export interface TransformSpec {
  // Unique identifier.
  id: string

  // Defines how this transform will be described in the "choose your transform"
  // dropdown.
  //
  // Note that we omit value because we will automatically set it to the
  // transform's id.
  dropdownConfig: Omit<IFieldDropdownOption, 'value'>

  // Fields needed by this transform.
  fields: IField[]

  // Actual callback which performs the transformation.
  transformData: TransformFunction
}

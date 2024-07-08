import type { As } from '@chakra-ui/react'

export const ADD_NEW_PLACEHOLDER_VALUE = '__ADD_NEW_PLACEHOLDER_VALUE__'

export type ComboboxItem<T = string> =
  | {
      /**
       * Value to be passed to onChange
       * Do not use `__ADD_NEW_PLACEHOLDER_VALUE__` as a value since it is reserved for add new
       */
      value: T
      /** Label to render on input when selected. `value` will be used if this is not provided */
      label?: string
      /** Description to render below label if provided */
      description?: string
      /** Whether item is disabled */
      disabled?: boolean
      /** Icon to display in input field when item is selected, if available */
      icon?: As
      /** Badge to display on the right of the label, if available */
      badge?: JSX.Element
      /** Whether this is an option to add new */
      isAddNew?: boolean
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any
    }
  | string
  | null

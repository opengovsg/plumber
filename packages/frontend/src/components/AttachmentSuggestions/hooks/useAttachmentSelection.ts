import { useCallback, useState } from 'react'
import { FieldValues, UseFormSetError } from 'react-hook-form'

import { Variable } from '@/helpers/variables'

import { CheckboxVariable } from '../components/Checkbox'
import { AttachmentConfigInput, validateFiles } from '../utils'

export function useAttachmentSelection(setError: UseFormSetError<FieldValues>) {
  const [selectedOptions, setSelectedOptions] = useState<
    (AttachmentConfigInput | CheckboxVariable)[]
  >([])
  const [selectedFile, setSelectedFile] = useState<Variable | null>(null)

  const onSuggestionClick = useCallback(
    (
      variable: CheckboxVariable,
      checked: boolean,
      onChange: (value: any) => void,
      values: string[],
    ) => {
      // NOTE: we use name instead of value to accommodate variables
      // We also add curly braces to check for attachments that are variables
      const { name, uploaded } = variable
      const nameToCheck = uploaded ? name : `{{${name}}}`
      if (!checked) {
        setSelectedOptions((prev) => prev.filter((p) => p.name !== name))
        onChange?.(values.filter((v: string) => v !== nameToCheck))
      } else {
        const { isValid, error } = validateFiles(variable, selectedOptions)
        if (!isValid) {
          setError(name, {
            type: 'invalidFile',
            message: error,
          })
        } else {
          setSelectedOptions((prevOptions) => [...prevOptions, variable])
          onChange?.(values.concat(nameToCheck))
        }
      }
    },
    [selectedOptions, setError],
  )

  return {
    selectedOptions,
    setSelectedOptions,
    selectedFile,
    setSelectedFile,
    onSuggestionClick,
  }
}

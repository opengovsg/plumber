import { FormControl } from '@chakra-ui/react'
import { FormLabel } from '@opengovsg/design-system-react'
import { type IApp } from '@plumber/types'
import { useCallback } from 'react'

import { SingleSelect } from '@/components/SingleSelect'

import { ConnectionDropdownOption } from '.'
import { DEFAULT_ADD_CONNECTION_LABEL } from '../constants'

interface ChooseConnectionDropdownProps {
  isDisabled: boolean
  connectionOptions: ConnectionDropdownOption[]
  onChange: (value: string, shouldRefetch: boolean) => void
  value: string | undefined
  application: IApp
  onAddNewConnection: () => void
}

function ChooseConnectionDropdown({
  isDisabled,
  connectionOptions,
  onChange,
  value,
  application,
  onAddNewConnection,
}: ChooseConnectionDropdownProps) {
  const onSelectionChange = useCallback(
    (value: string) => {
      onChange(value, false)
    },
    [onChange],
  )

  const canAddNew = application?.auth?.connectionType === 'user-added'
  const connectionModalLabel = application?.auth?.connectionModalLabel
  // An empty string hides the label.
  const fieldLabel =
    connectionModalLabel?.connectionFieldLabel ?? 'Choose connection'
  const items = [...connectionOptions]

  return (
    <>
      <FormControl>
        {fieldLabel && <FormLabel isRequired>{fieldLabel}</FormLabel>}
        <SingleSelect
          name="choose-connection"
          colorScheme="secondary"
          isRequired={true}
          isClearable={false}
          placeholder={connectionModalLabel?.connectionFieldPlaceholder}
          isDisabled={isDisabled}
          items={items}
          value={value || ''}
          onChange={onSelectionChange}
          addNew={
            canAddNew
              ? {
                  type: 'modal',
                  label:
                    connectionModalLabel?.addConnectionLabel ??
                    DEFAULT_ADD_CONNECTION_LABEL,
                  onSelected: onAddNewConnection,
                  isCreating: false,
                }
              : undefined
          }
        />
      </FormControl>
    </>
  )
}

export default ChooseConnectionDropdown

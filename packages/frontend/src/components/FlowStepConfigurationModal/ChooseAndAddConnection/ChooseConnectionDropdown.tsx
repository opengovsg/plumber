import { type IApp } from '@plumber/types'

import { useCallback } from 'react'
import { FormControl } from '@chakra-ui/react'
import { FormLabel } from '@opengovsg/design-system-react'

import { SingleSelect } from '@/components/SingleSelect'

import { DEFAULT_ADD_CONNECTION_LABEL } from './constants'
import { ConnectionDropdownOption } from '.'

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

  const items = [...connectionOptions]

  return (
    <>
      <FormControl>
        <FormLabel isRequired>Choose connection</FormLabel>
        <SingleSelect
          name="choose-connection"
          colorScheme="secondary"
          isRequired={true}
          isClearable={false}
          isDisabled={isDisabled}
          items={items}
          value={value || ''}
          onChange={onSelectionChange}
          addNew={
            application?.auth?.connectionType === 'user-added'
              ? {
                  type: 'modal',
                  label:
                    application?.auth?.connectionModalLabel
                      ?.addConnectionLabel ?? DEFAULT_ADD_CONNECTION_LABEL,
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

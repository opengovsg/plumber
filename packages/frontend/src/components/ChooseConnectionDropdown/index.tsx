import { IApp } from '@plumber/types'

import { useCallback, useState } from 'react'
import { FormControl } from '@chakra-ui/react'
import { BxPlus, FormLabel, SingleSelect } from '@opengovsg/design-system-react'
import AddAppConnection from 'components/AddAppConnection'

type ConnectionDropdownOption = {
  label: string
  value: string
  icon?: React.ElementType
}
interface ChooseConnectionDropdownProps {
  isDisabled: boolean
  connectionOptions: ConnectionDropdownOption[]
  onChange: (value: string, shouldRefetch: boolean) => void
  value: string | undefined
  application: IApp
}

const ADD_CONNECTION_VALUE = 'ADD_CONNECTION'
const ADD_NEW_CONNECTION_OPTION: ConnectionDropdownOption = {
  label: 'Add new connection',
  icon: BxPlus,
  value: ADD_CONNECTION_VALUE,
}

function ChooseConnectionDropdown({
  isDisabled,
  connectionOptions,
  onChange,
  value,
  application,
}: ChooseConnectionDropdownProps) {
  const [showAddConnectionDialog, setShowAddConnectionDialog] = useState(false)

  const onSelectionChange = useCallback(
    (value: string) => {
      if (value === ADD_CONNECTION_VALUE) {
        setShowAddConnectionDialog(true)
        return
      }
      onChange(value, false)
    },
    [onChange],
  )

  const handleAddConnectionClose = useCallback(
    (response: Record<string, any>) => {
      setShowAddConnectionDialog(false)
      const newConnectionId = response?.createConnection?.id as
        | string
        | undefined
      if (newConnectionId) {
        onChange(newConnectionId, true)
      }
    },
    [onChange],
  )

  const items = [...connectionOptions]
  if (application?.auth?.connectionType === 'user-added') {
    items.push(ADD_NEW_CONNECTION_OPTION)
  }

  return (
    <>
      <FormControl>
        <FormLabel isRequired>Choose connection</FormLabel>
        <SingleSelect
          name="choose-connection"
          isRequired={true}
          isClearable={false}
          isDisabled={isDisabled}
          items={items}
          value={value || ''}
          onChange={onSelectionChange}
        />
      </FormControl>
      {application && showAddConnectionDialog && (
        <AddAppConnection
          onClose={handleAddConnectionClose}
          application={application}
        />
      )}
    </>
  )
}

export default ChooseConnectionDropdown

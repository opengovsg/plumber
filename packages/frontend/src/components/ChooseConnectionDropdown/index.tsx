import { IApp } from '@plumber/types'

import { useCallback, useState } from 'react'
import { FormControl } from '@chakra-ui/react'
import { FormLabel } from '@opengovsg/design-system-react'

import AddAppConnection from '@/components/AddAppConnection'
import { SingleSelect } from '@/components/SingleSelect'

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
                  label: 'Add new connection',
                  onSelected: () => setShowAddConnectionDialog(true),
                  isCreating: false,
                }
              : undefined
          }
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

import { useContext } from 'react'
import { MdOpenInNew } from 'react-icons/md'
import { useDisclosure } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
import { Variable } from '@/helpers/variables'

import TableVariableModal from './TableVariableModal'
import { VariableItem } from '.'

interface TableVariableItemProps {
  variable: Variable
  onClick?: (variable: Variable) => void
}

export default function TableVariableItem(props: TableVariableItemProps) {
  const { onClick, variable } = props
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { currentTestExecutionStep } = useContext(EditorContext)

  // NOTE: we do not want the modal to open when there are 0 rows
  const canOpenModal = variable.displayedValue !== 'Preview 0 row(s)'

  return (
    <>
      <VariableItem
        key={`variable-${variable.name}`}
        variable={variable}
        // if onClick is provided, it means that the variable is being used in a Suggestions component
        // no need to open the modal or show the icon
        onClick={onClick ? onClick : canOpenModal ? onOpen : undefined}
        withIcon={onClick ? undefined : canOpenModal ? MdOpenInNew : undefined}
      />
      {!onClick && (
        <TableVariableModal
          isOpen={isOpen}
          onClose={onClose}
          currentExecutionStep={currentTestExecutionStep}
        />
      )}
    </>
  )
}

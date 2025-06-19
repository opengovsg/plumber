import { useContext } from 'react'
import { MdOpenInNew } from 'react-icons/md'
import { useDisclosure } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
import { Variable } from '@/helpers/variables'

import TableVariableModal from './TableVariableModal'
import { VariableItem } from '.'

interface TableVariableItemProps {
  variable: Variable
}

export default function TableVariableItem(props: TableVariableItemProps) {
  const { variable } = props
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { currentTestExecutionStep } = useContext(EditorContext)

  return (
    <>
      <VariableItem
        key={`variable-${variable.name}`}
        variable={variable}
        onClick={onOpen}
        withIcon={MdOpenInNew}
      />
      <TableVariableModal
        isOpen={isOpen}
        onClose={onClose}
        currentExecutionStep={currentTestExecutionStep}
      />
    </>
  )
}

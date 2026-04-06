import { useContext, useMemo } from 'react'
import { MdOpenInNew } from 'react-icons/md'
import { useDisclosure } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
import { Variable } from '@/helpers/variables'

import HtmlVariableModal from './HtmlVariableModal'
import TableVariableModal from './TableVariableModal'
import { VariableItem } from '.'

interface VariableItemWithModalProps {
  variable: Variable
  onClick?: (variable: Variable) => void
}

export default function VariableItemWithModal(
  props: VariableItemWithModalProps,
) {
  const { onClick, variable } = props
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { currentTestExecutionStep } = useContext(EditorContext)

  const canOpenModal =
    // we do not want to show a table preview if there are no rows
    (variable.type === 'table' &&
      variable.displayedValue !== 'Preview 0 row(s)') ||
    variable.type === 'html'

  const ModalComponent = useMemo(() => {
    switch (variable.type) {
      case 'table':
        return (
          <TableVariableModal
            variableId={variable.name}
            isOpen={isOpen}
            onClose={onClose}
            currentExecutionStep={currentTestExecutionStep}
          />
        )
      case 'html':
        return (
          <HtmlVariableModal
            variable={variable}
            isOpen={isOpen}
            onClose={onClose}
          />
        )
    }
  }, [currentTestExecutionStep, isOpen, onClose, variable])

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
      {!onClick && ModalComponent}
    </>
  )
}

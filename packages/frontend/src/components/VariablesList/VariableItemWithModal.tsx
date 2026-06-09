import { lazy, Suspense, useCallback, useContext, useTransition } from 'react'
import { useDisclosure } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
import { hexEncode } from '@/helpers/hex-encoding'
import { TableVariable, Variable } from '@/helpers/variables'

import HtmlVariableModal from './HtmlVariableModal'
import TableVariableModal from './TableVariableModal'
import { VariableItem } from '.'

const LazyViewAsEmailModal = lazy(() => import('../ViewAsEmailModal'))

interface VariableItemWithModalProps {
  variable: Variable
  onClick?: (variable: Variable) => void
  supportTableDisplay?: boolean
}

export default function VariableItemWithModal(
  props: VariableItemWithModalProps,
) {
  const { onClick, variable, supportTableDisplay } = props
  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure()
  const { currentTestExecutionStep } = useContext(EditorContext)

  // Check if this variable has table metadata (columns property)
  // This is set by extractVariables when type is 'table'
  const tableVar = variable as TableVariable
  const columns = tableVar.columns || []
  const hasTableMetadata = columns.length > 0

  const canOpenModal =
    // we do not want to show a table preview if there are no rows
    (variable.type === 'table' && variable.displayedValue !== '0 rows') ||
    variable.type === 'html' ||
    variable.type === 'email'

  const preloadModal = useCallback(() => {
    if (variable.type === 'email') {
      import('../ViewAsEmailModal')
    }
  }, [variable.type])

  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    if (!onClick) {
      // No onClick = viewing mode, open modal
      if (canOpenModal) {
        onModalOpen()
      }
      return
    }

    // Insert as table variable if:
    // 1. supportTableDisplay is enabled (rich-text field with table support), AND
    // 2. The variable has column metadata
    if (supportTableDisplay && hasTableMetadata) {
      // Email body field - insert with ALL columns selected by default
      // User can edit columns later via the TableVariablePill settings
      const allColumnIds = columns.map((c) => c.id)
      const modifier = `table:${allColumnIds.join(',')}`
      const hexModifier = hexEncode(modifier)

      const modifiedVariable: Variable = {
        ...variable,
        name: `${variable.name}|${hexModifier}`,
      }

      onClick(modifiedVariable)
    } else {
      // For-each field or no columns - insert raw variable directly
      onClick(variable)
    }
  }

  const renderModal = () => {
    switch (variable.type) {
      case 'table':
        return (
          <TableVariableModal
            variableId={variable.name}
            isOpen={isModalOpen}
            onClose={onModalClose}
            currentExecutionStep={currentTestExecutionStep}
          />
        )
      case 'html':
        return (
          <HtmlVariableModal
            variable={variable}
            isOpen={isModalOpen}
            onClose={onModalClose}
          />
        )
      case 'email':
        return (
          <Suspense fallback={null}>
            {isModalOpen && (
              <LazyViewAsEmailModal
                isOpen={isModalOpen}
                onClose={onModalClose}
                html={(variable.value as string) ?? ''}
                title="View email"
              />
            )}
          </Suspense>
        )
    }
  }

  // For viewing mode (no onClick), use the original behavior
  if (!onClick) {
    return (
      <>
        <VariableItem
          key={`variable-${variable.name}`}
          variable={variable}
          onClick={
            canOpenModal
              ? () => startTransition(() => onModalOpen())
              : undefined
          }
          withViewButton={canOpenModal}
          onViewButtonPreload={preloadModal}
          isViewButtonLoading={isPending}
        />
        {renderModal()}
      </>
    )
  }

  // For insertion mode - simple click to insert
  return (
    <VariableItem
      key={`variable-${variable.name}`}
      variable={variable}
      onClick={handleClick}
    />
  )
}

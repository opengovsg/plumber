import { useCallback, useRef } from 'react'
import { BiPlus } from 'react-icons/bi'
import { Box, Button, Input, Text } from '@chakra-ui/react'

import VariableCheckbox from '@/components/VariablesList/VariableCheckbox'
import { type Variable } from '@/helpers/variables'

function makeVariableComponent(
  variable: Variable,
  variableComponentType: 'checkbox' | 'list',
  onClick?: (variable: Variable, checked?: boolean) => void,
  addNew?: boolean,
  rest?: {
    checkedItems?: unknown[]
    allowDelete?: boolean
    onDelete?: (event: React.MouseEvent, file: Variable) => void
  },
): JSX.Element {
  return variableComponentType === 'checkbox' ? (
    <VariableCheckbox
      key={variable.value as string}
      variable={variable}
      onClick={onClick}
      addNew={addNew}
      {...rest}
    />
  ) : (
    <Box
      key={`suggestion-${variable.name}`}
      data-test="variable-suggestion-item"
      padding={onClick ? '0.5rem 1rem' : '1rem'}
      borderBottom={onClick ? undefined : '1px solid #EDEDED'}
      _hover={
        onClick
          ? {
              backgroundColor: 'secondary.50',
              cursor: 'pointer',
            }
          : undefined
      }
      _active={
        onClick
          ? {
              backgroundColor: 'secondary.100',
              cursor: 'pointer',
            }
          : undefined
      }
      // onClick doesn't work sometimes due to latency between mousedown and immediate mouseup event after
      onMouseDown={
        onClick
          ? () => {
              onClick(variable)
            }
          : undefined
      }
    >
      <Text textStyle="body-1" color="base.content.strong">
        {variable.label ?? variable.name}
      </Text>
      <Text textStyle="body-2" color="base.content.medium">
        {variable.displayedValue ?? variable.value?.toString() ?? ''}
      </Text>
    </Box>
  )
}

interface VariablesListProps {
  id?: string
  variables: Variable[]
  variableComponentType?: 'checkbox' | 'list'
  onClick?: (variable: Variable, checked?: boolean) => void
  checkedItems?: unknown[]
  allowDelete?: boolean
  processFile?: (file: File) => void
  onDelete?: (event: React.MouseEvent, file: Variable) => void
  addNew?: boolean
  accept?: string
}

export default function VariablesList(props: VariablesListProps) {
  const {
    id,
    variables,
    onClick,
    addNew,
    processFile,
    accept = 'text/plain',
    variableComponentType = 'list',
    ...rest
  } = props
  const fileUploadRef = useRef<HTMLInputElement | null>(null)

  const onFileChange = useCallback(
    ({ target }: React.ChangeEvent<HTMLInputElement>) => {
      const file = target.files?.[0]

      // Reset file input so the same file selected will trigger this onChange
      // function.
      if (fileUploadRef.current) {
        fileUploadRef.current.value = ''
      }
      if (!file) {
        return
      }

      processFile?.(file)
    },
    [processFile],
  )

  if (id !== 'uploadedAttachments' && (!variables || variables.length === 0)) {
    return <></>
  }

  return (
    <>
      {addNew && (
        <>
          <Input
            ref={fileUploadRef}
            name="fileUpload"
            type="file"
            hidden
            accept={accept}
            onChange={onFileChange}
          />
          <Button
            name="openFileUpload"
            variant="clear"
            onClick={() => fileUploadRef.current?.click()}
            w="100%"
            justifyContent="flex-start"
          >
            <BiPlus /> Add
          </Button>
        </>
      )}
      <Box
        data-test="variable-suggestion-group"
        maxH={64}
        overflowY="auto"
        p={onClick ? undefined : '1rem'}
      >
        {variables.map((variable) =>
          makeVariableComponent(
            variable,
            variableComponentType,
            onClick,
            addNew,
            rest,
          ),
        )}
      </Box>
    </>
  )
}

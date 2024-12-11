import { BiTrash } from 'react-icons/bi'
import { BsDot } from 'react-icons/bs'
import { Checkbox, Flex, Icon, IconButton, Text } from '@chakra-ui/react'
import { TouchableTooltip } from '@opengovsg/design-system-react'

import { formatFileSizeToStr } from '@/components/AttachmentMultiCheckbox/utils'
import { toPrettyDateString } from '@/helpers/dateTime'
import { Variable } from '@/helpers/variables'

export interface CheckboxVariable extends Variable {
  updatedAt?: string | number
  size?: number
  uploaded?: boolean
}

interface VariableCheckboxProps {
  variable: CheckboxVariable
  onClick?: (variable: CheckboxVariable, checked?: boolean) => void
  checkedItems?: unknown[]
  allowDelete?: boolean
  onDelete?: (event: React.MouseEvent, file: Variable) => void
  addNew?: boolean
  accept?: string
}

export default function VariableCheckbox(props: VariableCheckboxProps) {
  const { variable, checkedItems, onClick, allowDelete, onDelete } = props
  const { label, size, value, updatedAt = null, uploaded } = variable
  return (
    <Checkbox
      key={value as string}
      isChecked={checkedItems?.includes(value)}
      onChange={(e) => {
        onClick?.(variable, e.target.checked)
      }}
      _hover={{
        backgroundColor: 'primary.100',
        cursor: 'pointer',
        outline: 'none',
      }}
      p="0.5rem"
      outline="none"
    >
      <Flex alignItems="center" justify="space-between" maxW="100%">
        <Flex direction="column">
          <TouchableTooltip
            label={(label?.length ?? 0) > 20 ? label : undefined}
          >
            <Text noOfLines={1}>{label}</Text>
          </TouchableTooltip>
          {uploaded && (
            <Flex direction="row" alignItems="center">
              <Text textStyle="body-2">
                {size ? formatFileSizeToStr(size) : ''}
              </Text>
              <Icon as={BsDot} />
              <Text textStyle="body-2">
                {toPrettyDateString(updatedAt, 'iso')}
              </Text>
            </Flex>
          )}
        </Flex>
        {allowDelete && (
          <IconButton
            icon={<BiTrash />}
            aria-label="Delete variable"
            size="sm"
            variant="clear"
            minH={0}
            onClick={(e) => onDelete?.(e, variable)}
            mr="0.5rem"
          />
        )}
      </Flex>
    </Checkbox>
  )
}

import { ChangeEvent, memo } from 'react'
import { BiTrash } from 'react-icons/bi'
import { BsDot } from 'react-icons/bs'
import {
  Checkbox as ChakraCheckbox,
  Flex,
  Icon,
  IconButton,
  Text,
} from '@chakra-ui/react'
import { TouchableTooltip } from '@opengovsg/design-system-react'

import { formatFileSizeToStr } from '@/components/AttachmentSuggestions/utils'
import { toPrettyDateString } from '@/helpers/dateTime'
import { Variable } from '@/helpers/variables'

export interface CheckboxVariable extends Variable {
  updatedAt?: string | number
  size?: number
  uploaded?: boolean
  source?: string
}

interface CheckboxProps {
  variable: CheckboxVariable
  onClick: (variable: CheckboxVariable, checked: boolean) => void
  isChecked: boolean
  allowDelete?: boolean
  onDelete?: (event: React.MouseEvent, file: Variable) => void
  addNew?: boolean
}

function Checkbox(props: CheckboxProps) {
  const { variable, isChecked, onClick, allowDelete, onDelete } = props
  const {
    displayedValue,
    label,
    size,
    value,
    updatedAt = null,
    uploaded,
  } = variable

  const getInfoText = (info?: number | string | null) => {
    return (
      <Text
        textStyle="body-2"
        noOfLines={1}
        color="base.content.medium"
        overflowX="hidden"
      >
        {info ?? ''}
      </Text>
    )
  }

  // Note: removes the outline around the checkbox that is last focused
  const handleBlur = (e: ChangeEvent<HTMLInputElement>) => e.target.blur()

  return (
    <ChakraCheckbox
      key={value as string}
      isChecked={isChecked}
      onChange={(e) => {
        onClick?.(variable, e.target.checked)
        handleBlur(e)
      }}
      _hover={{
        backgroundColor: 'primary.100',
        cursor: 'pointer',
      }}
      p="0.5rem"
      overflowX="hidden"
    >
      <Flex alignItems="center" justify="space-between" maxW="100%">
        <Flex direction="column" overflowX="hidden">
          <TouchableTooltip label={uploaded ? displayedValue : label}>
            <Text noOfLines={1}>{uploaded ? displayedValue : label}</Text>
          </TouchableTooltip>
          <Flex direction="row" alignItems="center">
            {uploaded ? (
              <Flex direction="row" alignItems="center">
                {getInfoText(size ? formatFileSizeToStr(size) : '')}
                <Icon as={BsDot} />
                {getInfoText(toPrettyDateString(updatedAt, 'iso'))}
              </Flex>
            ) : (
              getInfoText(displayedValue)
            )}
          </Flex>
        </Flex>
        {allowDelete && (
          <IconButton
            icon={<BiTrash />}
            aria-label="Delete variable"
            size="sm"
            variant="clear"
            minH={0}
            onClick={(e) => onDelete?.(e, variable)}
          />
        )}
      </Flex>
    </ChakraCheckbox>
  )
}

export default memo(Checkbox)

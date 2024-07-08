import { useMemo } from 'react'
import { Flex, Icon, ListItem, Text } from '@chakra-ui/react'
import { dataAttr } from '@chakra-ui/utils'

import { useSelectContext } from '../../SelectContext'
import { ComboboxItem } from '../../types'
import {
  isItemDisabled,
  itemToBadge,
  itemToDescriptionString,
  itemToIcon,
  itemToLabelString,
} from '../../utils/itemUtils'

import { DropdownItemTextHighlighter } from './DropdownItemTextHighlighter'

export interface DropdownItemProps {
  item: ComboboxItem
  index: number
}

export const DropdownItem = ({
  item,
  index,
}: DropdownItemProps): JSX.Element => {
  const { getItemProps, isItemSelected, inputValue, styles } =
    useSelectContext()

  const { icon, label, description, isDisabled, isActive, badge } = useMemo(
    () => ({
      icon: itemToIcon(item),
      label: itemToLabelString(item),
      description: itemToDescriptionString(item),
      isDisabled: isItemDisabled(item),
      isActive: isItemSelected(item),
      badge: itemToBadge(item),
    }),
    [isItemSelected, item],
  )

  return (
    <ListItem
      sx={styles.item}
      data-active={dataAttr(isActive)}
      {...getItemProps({
        item,
        index,
        disabled: isDisabled,
      })}
    >
      <Flex justifyContent="space-between" alignItems="center">
        <Flex flexDir="column">
          <Flex gap={1.5} alignItems="center">
            {icon ? <Icon as={icon} sx={styles.icon} /> : null}
            <Text
              minWidth={0}
              textOverflow="ellipsis"
              whiteSpace="nowrap"
              overflowX="hidden"
            >
              <DropdownItemTextHighlighter
                inputValue={inputValue ?? ''}
                textToHighlight={label}
              />
            </Text>
            {badge}
          </Flex>
          {description && (
            <Text
              sx={{
                ...styles.itemDescription,
                ...(isDisabled ? { color: 'red.500' } : {}),
              }}
            >
              <DropdownItemTextHighlighter
                inputValue={inputValue ?? ''}
                textToHighlight={description}
              />
            </Text>
          )}
        </Flex>
      </Flex>
    </ListItem>
  )
}

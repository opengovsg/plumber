import { useMemo, useState } from 'react'
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

  // add this for hover detection
  const [isHovered, setIsHovered] = useState(false)
  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
  }

  const { icon, badge, label, description, isDisabled, isActive } = useMemo(
    () => ({
      icon: itemToIcon(item),
      badge: itemToBadge(item),
      label: itemToLabelString(item),
      description: itemToDescriptionString(item),
      isDisabled: isItemDisabled(item),
      isActive: isItemSelected(item),
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
      style={
        isHovered
          ? {
              backgroundColor: '#f8f9fa',
              cursor: 'pointer',
            }
          : isActive
          ? {
              backgroundColor: '#e9eaee',
              cursor: 'pointer',
            }
          : undefined
      }
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Flex flexDir="column">
        <Flex gap={1.5}>
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
          <Text sx={styles.itemDescription}>
            <DropdownItemTextHighlighter
              inputValue={inputValue ?? ''}
              textToHighlight={description}
            />
          </Text>
        )}
      </Flex>
    </ListItem>
  )
}

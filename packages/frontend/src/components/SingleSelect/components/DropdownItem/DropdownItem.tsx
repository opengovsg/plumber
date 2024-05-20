import { useMemo, useState } from 'react'
import { Flex, Icon, ListItem, Text } from '@chakra-ui/react'
import { dataAttr } from '@chakra-ui/utils'
import { Badge } from '@opengovsg/design-system-react'

import { useSelectContext } from '../../SelectContext'
import { ComboboxItem } from '../../types'
import {
  isItemDisabled,
  isItemInstant,
  isItemNew,
  itemToDescriptionString,
  itemToIcon,
  itemToLabelString,
} from '../../utils/itemUtils'

import { DropdownItemTextHighlighter } from './DropdownItemTextHighlighter'

export interface DropdownItemProps {
  item: ComboboxItem
  index: number
}

/**
 * Note: This is customised just for Plumber.
 * A new badge is to indicate that the app is new.
 * An instant badge is to indicate that the event is a webhook trigger.
 */

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

  const {
    icon,
    label,
    description,
    isDisabled,
    isActive,
    isAppNew,
    isEventInstant,
  } = useMemo(
    () => ({
      icon: itemToIcon(item),
      label: itemToLabelString(item),
      description: itemToDescriptionString(item),
      isDisabled: isItemDisabled(item),
      isActive: isItemSelected(item),
      isAppNew: isItemNew(item),
      isEventInstant: isItemInstant(item),
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
              cursor: isDisabled ? 'not-allowed' : 'pointer',
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
      <Flex justifyContent="space-between" alignItems="center">
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
            {isAppNew && (
              <Badge
                bgColor="interaction.muted.main.active"
                color="primary.600"
              >
                New
              </Badge>
            )}
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
        {isEventInstant && (
          <Badge bgColor="interaction.muted.main.active" color="primary.600">
            Instant
          </Badge>
        )}
      </Flex>
    </ListItem>
  )
}

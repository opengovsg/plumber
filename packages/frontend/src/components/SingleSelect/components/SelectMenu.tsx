import { BiRefresh } from 'react-icons/bi'
import Markdown from 'react-markdown'
import { Virtuoso } from 'react-virtuoso'
import { List, ListItem, Portal } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import { infoboxMdComponents } from '@/components/MarkdownRenderer/CustomMarkdownComponents'
import PrimarySpinner from '@/components/PrimarySpinner'

import { useSelectContext } from '../SelectContext'
import { itemToValue } from '../utils/itemUtils'

import { DropdownItem } from './DropdownItem'
import { useSelectPopover } from './SelectPopover'

export const SelectMenu = (): JSX.Element => {
  const {
    getMenuProps,
    isOpen,
    items,
    nothingFoundLabel,
    noOptionsMessage,
    styles,
    virtualListRef,
    virtualListHeight,
    onRefresh,
    isRefreshLoading,
    inputValue,
  } = useSelectContext()

  const { floatingRef, floatingStyles } = useSelectPopover()
  const isEmpty = isOpen && items.length === 0

  return (
    <Portal>
      <List
        {...getMenuProps(
          { ref: floatingRef },
          // Suppressing ref error since this will be in a portal and will be conditionally rendered.
          // See https://github.com/downshift-js/downshift/issues/1272#issuecomment-1063244446
          { suppressRefError: true },
        )}
        style={floatingStyles}
        sx={{ ...styles.list, minWidth: '25vw' }}
        zIndex="dropdown"
      >
        {isOpen && items.length > 0 && (
          <Virtuoso
            ref={virtualListRef}
            data={items}
            overscan={virtualListHeight / 2}
            style={{ height: virtualListHeight }}
            itemContent={(index, item) => {
              return (
                <DropdownItem
                  key={`${itemToValue(item)}${index}`}
                  item={item}
                  index={index}
                />
              )
            }}
          />
        )}
        {isEmpty && noOptionsMessage ? (
          // Mirrors the variables popover's empty state, so both kinds of
          // "nothing to pick here" guidance read the same.
          <ListItem
            role="option"
            p={4}
            opacity={0.5}
            textStyle="body-1"
            color="base.content.medium"
            // Blurring the input closes the menu, which would tear the link in
            // the message out from under the click that opens it.
            onMouseDown={(e) => e.preventDefault()}
          >
            <Markdown linkTarget="_blank" components={infoboxMdComponents}>
              {noOptionsMessage}
            </Markdown>
          </ListItem>
        ) : null}
        {isEmpty && !noOptionsMessage && inputValue?.length ? (
          <ListItem role="option" sx={styles.emptyItem}>
            {nothingFoundLabel}
          </ListItem>
        ) : null}
        {/* Allow reload of dynamic data fields */}
        {isOpen && onRefresh && (
          <Button
            leftIcon={<BiRefresh />}
            w="100%"
            variant="clear"
            onMouseDown={(e) => {
              e.preventDefault()
            }}
            spinner={<PrimarySpinner fontSize={24} />}
            onClick={onRefresh}
            isLoading={isRefreshLoading}
          >
            Refresh items
          </Button>
        )}
      </List>
    </Portal>
  )
}

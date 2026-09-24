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
        {isOpen &&
        items.length === 0 &&
        (noOptionsMessage || inputValue?.length) ? (
          <ListItem
            role="option"
            sx={styles.emptyItem}
            // Blurring the input closes the menu, which would tear a link in
            // the message out from under the click that opens it.
            onMouseDown={(e) => e.preventDefault()}
          >
            {noOptionsMessage ? (
              <Markdown linkTarget="_blank" components={infoboxMdComponents}>
                {noOptionsMessage}
              </Markdown>
            ) : (
              nothingFoundLabel
            )}
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

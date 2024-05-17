import { BiRefresh } from 'react-icons/bi'
import { Virtuoso } from 'react-virtuoso'
import { List, ListItem, Portal } from '@chakra-ui/react'
import { Button, Spinner } from '@opengovsg/design-system-react'

import { useSelectContext } from '../SelectContext'
import type { ComboboxItem } from '../types'
import { itemToValue } from '../utils/itemUtils'

import { DropdownItem } from './DropdownItem'
import { useSelectPopover } from './SelectPopover'

export const SelectMenu = (): JSX.Element => {
  const {
    getMenuProps,
    isOpen,
    items,
    nothingFoundLabel,
    styles,
    virtualListRef,
    virtualListHeight,
    onRefresh,
    isRefreshLoading,
    inputValue,
    freeSolo,
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
        sx={styles.list}
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
        {/* Freesolo enabled and non-empty input --> show new dropdown option
         *  Freesolo disabled and no filtered input --> show nothing found label
         */}
        {isOpen && items.length === 0 ? (
          freeSolo ? (
            inputValue !== '' ? (
              <DropdownItem
                item={
                  {
                    label: inputValue,
                    value: inputValue,
                    description: inputValue,
                  } as ComboboxItem
                }
                index={items.length}
              />
            ) : null
          ) : (
            <ListItem role="option" sx={styles.emptyItem}>
              {nothingFoundLabel}
            </ListItem>
          )
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
            spinner={<Spinner fontSize={24} color="primary.600" />}
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

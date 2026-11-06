import { Box, Flex, Icon, Text } from '@chakra-ui/react'
import { IconButton } from '@opengovsg/design-system-react'
import type { IField } from '@plumber/types'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useWatch } from 'react-hook-form'
import { BiChevronDown, BiChevronUp, BiPlus, BiTrash } from 'react-icons/bi'

import InputCreator, { InputCreatorProps } from '@/components/InputCreator'
import { SelectMenuOverrideContext } from '@/components/SingleSelect/MenuOverrideContext'
import useDynamicData from '@/hooks/useDynamicData'

// Shows 3.5 columns at any width, so the half column hints at more to the right.
const VISIBLE_COLUMNS = 3.5
const FALLBACK_COLUMN_WIDTH = 196
// The hover state of a column: a slightly darker header and a faint cell.
const HEADER_BG = '#F8F9F9'
const HEADER_HOVER_BG = '#F1F2F4'
const CELL_HOVER_BG = '#F8F9F9'
const FADE_WIDTH = '74px'
const HEADER_HEIGHT = '56px'
const CELL_HEIGHT = '56px'
// One inset for header, value and sample rows keeps their text on one left edge.
const CELL_PX = 3
const CELL_PY = 2
const REMOVE_BUTTON_SIZE = '28px'
// Same icon family and stroke as the + on the add-column slots.
const CHEVRON_ICONS = { open: BiChevronUp, closed: BiChevronDown }
const ICON_SIZE = '16px'
const VARIABLE_PANEL_MAX_WIDTH = 600
// Each column's menu is as wide as its column and uses a plain, short hint.
const MENU_OVERRIDE = {
  anchorSelector: '[data-menu-anchor]',
  chevronIcons: CHEVRON_ICONS,
  hintLabel: 'Type to name column',
  compactHint: true,
}

// Strips the input chrome so dropdowns and variable inputs read as table cells.
const BORDERLESS_INPUT_STYLE = {
  '& input, & button, & [role="combobox"]': {
    border: 'none !important',
    boxShadow: 'none !important',
    background: 'transparent !important',
    minH: 'unset',
    paddingInline: '0 !important',
  },
  '& .editor': {
    border: 'none !important',
    boxShadow: 'none !important',
    background: 'transparent !important',
  },
  '& .ProseMirror': { fontSize: '14px', lineHeight: '20px' },
  '& .editor__content, & .tiptap, & .ProseMirror': {
    padding: '0 !important',
    minHeight: 'unset !important',
  },
  // Room for the chip's 1px selection ring, which the single-line editor would
  // otherwise clip. The editor shifts left by the same amount, so text stays aligned.
  '& .chakra-badge': { marginInline: '1px !important' },
  // The ring also needs 1px above and below, since the editor clips overflow.
  // Padding gives it room, and the negative margin keeps the cell's size.
  '& .single-line-editor': {
    marginInlineStart: '-1px',
    paddingBlock: '2px',
    marginBlock: '-2px',
  },
}

// The select draws its visible text in a separate overlay with its own padding.
// Taking that overlay into the flow lets the chevron follow the text, and an
// invisible input stretched over both still receives clicks and typing.
const HEADER_INPUT_STYLE = {
  ...BORDERLESS_INPUT_STYLE,
  // The remove button only shows while its header is hovered or focused, and
  // always on touch screens where there is no hover.
  '& .remove-column-button': {
    opacity: 0,
    transition: 'opacity 0.15s ease-out',
    '@media (hover: none)': { opacity: 1 },
  },
  '& .chakra-input__group': {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    minWidth: '6ch',
    maxWidth: '100%',
  },
  '& .chakra-input__group > .chakra-stack': {
    position: 'static !important',
    padding: '0 !important',
    minWidth: 0,
    width: 'auto',
    height: 'auto',
  },
  '& .chakra-input__group > .chakra-stack p': {
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '20px',
  },
  '& .chakra-input__group > input': {
    position: 'absolute !important',
    inset: '0 !important',
    width: '100% !important',
    height: '100% !important',
    paddingInline: '0 !important',
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '20px',
  },
  '& .chakra-input__group > input::placeholder': {
    color: 'rgba(44, 46, 52, 0.4)',
    opacity: 1,
  },
  // With no column chosen the placeholder is the text, so let it size the cell
  // and keep the chevron right after it.
  '& .chakra-input__group:has(> .chakra-stack p:empty) > input': {
    position: 'static !important',
    inset: 'auto !important',
    width: 'auto !important',
    height: 'auto !important',
    fieldSizing: 'content',
  },
  '& .chakra-input__right-element': {
    position: 'static !important',
    width: 'auto !important',
    height: 'auto !important',
    flexShrink: 0,
    marginInlineStart: '4px',
    zIndex: 1,
    '& svg': { width: ICON_SIZE, height: ICON_SIZE },
  },
}

type TileColumnOption = { name: string; value: string }

type ColumnsTableProps = {
  name: string
  rowIds: string[]
  subFields: IField[]
  canAddColumn: boolean
  canRemoveColumn: boolean
  isEditorReadOnly: boolean
  onAddColumn: (initial?: Record<string, unknown>) => void
  onRemoveColumn: (index: number) => void
  onReplaceColumns: (rows: Record<string, unknown>[]) => void
} & Omit<InputCreatorProps, 'schema' | 'namePrefix'>

function hasValue(value: unknown): boolean {
  return (
    String(value ?? '')
      .replace(/<[^>]*>/g, '')
      .trim() !== ''
  )
}

/**
 * Renders each row of a `multirow-multicol` field as a table column, so the
 * user sees the shape of the data they are creating.
 */
export default function ColumnsTable(props: ColumnsTableProps): JSX.Element {
  const {
    name,
    rowIds,
    subFields,
    canAddColumn,
    canRemoveColumn,
    isEditorReadOnly,
    onAddColumn,
    onRemoveColumn,
    onReplaceColumns,
    ...forwardedInputCreatorProps
  } = props
  const [headerField, ...valueFields] = subFields
  const sampleField = valueFields[0]
  const outerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [columnWidth, setColumnWidth] = useState(FALLBACK_COLUMN_WIDTH)
  const [hasMoreToRight, setHasMoreToRight] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)
  // Set when the pinned add button is used, so the new column is scrolled into view.
  const scrollToEndAfterAdd = useRef(false)

  // Probe only: lists the tile's columns without writing to the form.
  const { data: columnData } = useDynamicData(
    forwardedInputCreatorProps.stepId,
    headerField,
    null,
  )
  const columnOptions = columnData as TileColumnOption[] | undefined
  const rows = useWatch({ name }) as Record<string, unknown>[] | undefined
  const usedColumnIds = new Set(
    (rows ?? []).map((row) => row?.[headerField.key]).filter(Boolean),
  )
  const unusedColumns = (columnOptions ?? []).filter(
    (option) => !usedColumnIds.has(option.value),
  )
  // Nothing left to pick from, so a blank header is where the user names a new column.
  const canNameNewColumns = columnOptions != null && unusedColumns.length === 0

  // A new step starts with every tile column so the table looks like the tile.
  const prefilledFor = useRef<string>()
  useEffect(() => {
    if (isEditorReadOnly || !canAddColumn || !columnOptions?.length) {
      return
    }
    const isBlank = (rows ?? []).every(
      (row) => !row?.[headerField.key] && !hasValue(row?.[sampleField?.key]),
    )
    const signature = columnOptions.map((option) => option.value).join(',')
    if (!isBlank) {
      // Already set up, so a later clear must stay cleared.
      prefilledFor.current = signature
      return
    }
    if (prefilledFor.current === signature) {
      return
    }
    prefilledFor.current = signature
    onReplaceColumns(
      columnOptions.map((option) => ({ [headerField.key]: option.value })),
    )
  }, [
    columnOptions,
    rows,
    isEditorReadOnly,
    canAddColumn,
    headerField.key,
    sampleField?.key,
    onReplaceColumns,
  ])

  // The sole column can still be cleared, but only when it holds something.
  const showRemove = (index: number): boolean => {
    if (!canRemoveColumn) {
      return false
    }
    if (rowIds.length > 1) {
      return true
    }
    const row = rows?.[index]
    return !!row?.[headerField.key] || hasValue(row?.[sampleField?.key])
  }

  // Real columns plus the add slot overflow the table only past this point.
  const needsScroll = rowIds.length + (canAddColumn ? 1 : 0) > VISIBLE_COLUMNS

  const updateLayout = useCallback(() => {
    const outer = outerRef.current
    const wrapper = wrapperRef.current
    if (outer && wrapper) {
      setColumnWidth(outer.clientWidth / VISIBLE_COLUMNS)
      setContainerWidth(wrapper.clientWidth)
    }
    const el = scrollRef.current
    if (!el) {
      return
    }
    setHasMoreToRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  // Measure before paint so columns never flash at a fallback width.
  useLayoutEffect(() => {
    updateLayout()
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(updateLayout)
    if (outerRef.current) {
      observer.observe(outerRef.current)
    }
    if (wrapperRef.current) {
      observer.observe(wrapperRef.current)
    }
    return () => observer.disconnect()
  }, [updateLayout, rowIds.length, canAddColumn, needsScroll])

  useEffect(() => {
    if (!scrollToEndAfterAdd.current) {
      return
    }
    scrollToEndAfterAdd.current = false
    scrollRef.current?.scrollTo({
      left: scrollRef.current.scrollWidth,
      behavior: 'smooth',
    })
  }, [rowIds.length])

  const handlePinnedAdd = () => {
    scrollToEndAfterAdd.current = true
    onAddColumn()
  }

  return (
    <Box ref={outerRef}>
      <Box ref={wrapperRef} position="relative">
        <Flex
          ref={scrollRef}
          // The variable panel lines up with the table, and stays readable
          // instead of stretching across a wide drawer.
          data-popover-anchor
          data-popover-max-width={VARIABLE_PANEL_MAX_WIDTH}
          onScroll={updateLayout}
          overflowX="auto"
          w="100%"
          border="1px solid"
          borderColor="base.divider.medium"
          borderRadius="8px"
          sx={{
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {rowIds.map((rowId, index) => {
            const namePrefix = `${name}.${index}`
            return (
              <Flex
                key={`${rowId}-${index}`}
                data-popover-column
                flexDir="column"
                flex="0 0 auto"
                w={`${columnWidth}px`}
                borderLeft={index === 0 ? 'none' : '1px solid'}
                borderColor="base.divider.medium"
                // Hovering anywhere in the column shades it and reveals its remove button.
                sx={{
                  '&:hover .remove-column-button, &:focus-within .remove-column-button':
                    { opacity: 1 },
                  '&:hover > [data-column-header]': { bg: HEADER_HOVER_BG },
                  '&:hover > [data-column-cell]': { bg: CELL_HOVER_BG },
                }}
              >
                <Flex
                  data-menu-anchor
                  data-column-header
                  role="group"
                  position="relative"
                  bg={HEADER_BG}
                  h={HEADER_HEIGHT}
                  px={CELL_PX}
                  alignItems="center"
                  sx={HEADER_INPUT_STYLE}
                >
                  <Box
                    flex={1}
                    minW={0}
                    textStyle="subhead-2"
                    mr={showRemove(index) ? REMOVE_BUTTON_SIZE : 0}
                  >
                    <SelectMenuOverrideContext.Provider value={MENU_OVERRIDE}>
                      <InputCreator
                        schema={{
                          ...headerField,
                          label: undefined,
                          description: undefined,
                          // With no tile column left to pick, typing a name creates one.
                          ...(canNameNewColumns && {
                            placeholder: 'Name column',
                          }),
                        }}
                        namePrefix={namePrefix}
                        parentType="multicol"
                        {...forwardedInputCreatorProps}
                      />
                    </SelectMenuOverrideContext.Provider>
                  </Box>
                  {showRemove(index) && (
                    <IconButton
                      variant="clear"
                      size="xs"
                      colorScheme="secondary"
                      aria-label="Remove column"
                      icon={<BiTrash />}
                      isDisabled={isEditorReadOnly}
                      onClick={() => onRemoveColumn(index)}
                      className="remove-column-button"
                      position="absolute"
                      right={2}
                      zIndex={2}
                      // A white rounded square so the bin reads as a button on the shaded header.
                      boxSize={REMOVE_BUTTON_SIZE}
                      minW={REMOVE_BUTTON_SIZE}
                      bg="white"
                      color="base.content.medium"
                      borderRadius="md"
                      sx={{ '& svg': { width: ICON_SIZE, height: ICON_SIZE } }}
                      _hover={{ bg: 'white', color: 'base.content.strong' }}
                      _active={{ bg: 'base.canvas.alt' }}
                    />
                  )}
                </Flex>
                <Flex
                  data-column-cell
                  flexDir="column"
                  gap={2}
                  justifyContent="center"
                  px={CELL_PX}
                  py={CELL_PY}
                  minH={CELL_HEIGHT}
                  bg="white"
                  borderTop="1px solid"
                  borderColor="base.divider.medium"
                  sx={BORDERLESS_INPUT_STYLE}
                >
                  {valueFields.map((valueField, valueIndex) => (
                    <div key={`${valueField.key}.${valueIndex}`}>
                      <InputCreator
                        schema={{
                          ...valueField,
                          label: undefined,
                          description: undefined,
                        }}
                        namePrefix={namePrefix}
                        parentType="multicol"
                        {...forwardedInputCreatorProps}
                      />
                    </div>
                  ))}
                </Flex>
              </Flex>
            )
          })}
          {rowIds.length === 1 && canAddColumn ? (
            // One real column: the spare slots merge into one long add button.
            <Flex
              as="button"
              type="button"
              role="group"
              flexDir="column"
              flex={`1 0 ${columnWidth}px`}
              borderLeft="1px solid"
              borderColor="base.divider.medium"
              disabled={isEditorReadOnly}
              onClick={() => onAddColumn()}
              aria-label="Add column"
              textAlign="left"
              _hover={{ '& > div': { bg: 'base.canvas.alt' } }}
            >
              <Flex
                bg={HEADER_BG}
                h={HEADER_HEIGHT}
                px={CELL_PX}
                alignItems="center"
                gap={1}
                w="100%"
              >
                <Icon
                  as={BiPlus}
                  boxSize={ICON_SIZE}
                  color="base.content.medium"
                  opacity={0.7}
                />
                <Text
                  textStyle="subhead-2"
                  color="base.content.medium"
                  opacity={0.7}
                >
                  Add column
                </Text>
              </Flex>
              <Box
                flex={1}
                minH={CELL_HEIGHT}
                bg="white"
                borderTop="1px solid"
                borderColor="base.divider.medium"
              />
            </Flex>
          ) : (
            <>
              {Array.from({
                length: Math.max(
                  Math.floor(containerWidth / columnWidth) - rowIds.length,
                  canAddColumn ? 1 : 0,
                ),
              }).map((_, slotIndex) => {
                // Every spare slot adds a blank column. The first always shows
                // its label and later ones reveal it on hover. Slots never
                // suggest a specific column.
                const isGhost = canAddColumn
                const showsLabelAlways = slotIndex === 0
                return (
                  <Flex
                    key={`slot-${slotIndex}`}
                    {...(isGhost
                      ? {
                          as: 'button' as const,
                          type: 'button' as const,
                          disabled: isEditorReadOnly,
                        }
                      : {})}
                    flexDir="column"
                    flex={`1 0 ${columnWidth}px`}
                    borderLeft="1px solid"
                    borderColor="base.divider.medium"
                    onClick={isGhost ? () => onAddColumn() : undefined}
                    aria-label={isGhost ? 'Add column' : undefined}
                    role={isGhost ? 'group' : undefined}
                    textAlign="left"
                    _hover={
                      isGhost
                        ? { '& > div': { bg: 'base.canvas.alt' } }
                        : undefined
                    }
                  >
                    <Flex
                      bg={HEADER_BG}
                      h={HEADER_HEIGHT}
                      px={CELL_PX}
                      alignItems="center"
                      gap={1}
                      w="100%"
                    >
                      {isGhost && (
                        <>
                          <Icon
                            as={BiPlus}
                            boxSize={ICON_SIZE}
                            color="base.content.medium"
                            opacity={showsLabelAlways ? 0.7 : 0}
                            _groupHover={{ opacity: 0.7 }}
                            _groupFocusVisible={{ opacity: 0.7 }}
                          />
                          <Text
                            textStyle="subhead-2"
                            color="base.content.medium"
                            opacity={showsLabelAlways ? 0.7 : 0}
                            _groupHover={{ opacity: 0.7 }}
                            _groupFocusVisible={{ opacity: 0.7 }}
                            noOfLines={1}
                          >
                            Add column
                          </Text>
                        </>
                      )}
                    </Flex>
                    <Box
                      flex={1}
                      minH={CELL_HEIGHT}
                      bg="white"
                      borderTop="1px solid"
                      borderColor="base.divider.medium"
                    />
                  </Flex>
                )
              })}
            </>
          )}
        </Flex>
        {hasMoreToRight &&
          needsScroll && (
            // Clipped by the table's own border, so it never spills past it.
            <Box
              position="absolute"
              top="1px"
              right="1px"
              bottom="1px"
              w={FADE_WIDTH}
              borderRightRadius="7px"
              pointerEvents="none"
              bgGradient="linear(to-r, rgba(255,255,255,0) 0%, white 59%)"
            />
          )}
        {hasMoreToRight &&
          needsScroll &&
          canAddColumn &&
          !isEditorReadOnly && (
            // Pinned to the right edge, so a column can be added without
            // scrolling to the end. The zone is wider than the button so it is
            // easy to hit.
            <Flex
              role="group"
              position="absolute"
              // Above the header inputs, which are positioned with their own z-index.
              zIndex={3}
              top="1px"
              right="1px"
              bottom="1px"
              w="56px"
              alignItems="center"
              justifyContent="center"
              borderRightRadius="7px"
            >
              <Flex
                as="button"
                type="button"
                position="relative"
                alignItems="center"
                justifyContent="center"
                aria-label="Add column"
                onClick={handlePinnedAdd}
                h="calc(100% - 16px)"
                w="32px"
                flexShrink={0}
                borderRadius="md"
                border="1px dashed"
                borderColor="base.divider.strong"
                bg="white"
                color="base.content.medium"
                cursor="pointer"
                opacity={0}
                transition="opacity 0.15s ease-out"
                _groupHover={{ opacity: 1 }}
                _focusVisible={{ opacity: 1 }}
                // Opaque fill and a soft shadow lift it off the cells beneath.
                // The fill stays white on hover, since grey blends into the table.
                boxShadow="0 4px 12px rgba(0, 0, 0, 0.08)"
                sx={{
                  '&:hover': { color: 'base.content.strong' },
                  '@media (hover: none)': { opacity: 1 },
                }}
              >
                <Icon as={BiPlus} boxSize={ICON_SIZE} />
              </Flex>
            </Flex>
          )}
      </Box>
    </Box>
  )
}

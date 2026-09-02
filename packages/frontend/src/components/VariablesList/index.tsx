import { TDataOutMetadatumType } from '@plumber/types'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Flex,
  type SystemStyleObject,
  Tag,
  Text,
  Tooltip,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import { useVirtualizer } from '@tanstack/react-virtual'

import { type Variable } from '@/helpers/variables'
import { POPOVER_MOTION_PROPS } from '@/theme/constants'

import VariableItemWithModal from './VariableItemWithModal'

const VARIABLES_WITH_MODALS = ['table', 'html', 'email']
const VARIABLE_ITEM_HEIGHT = 77
const SUGGESTION_VARIABLE_ITEM_HEIGHT = 61

function VariableTag({
  type,
}: {
  type?: TDataOutMetadatumType
}): JSX.Element | null {
  const { label, tooltip } = useMemo(() => {
    switch (type) {
      case 'array':
      case 'table':
        return {
          label: 'List',
          tooltip:
            'This variable can be used in the For-each action or the body field in Email by Postman action.',
        }
      case 'dropdown':
        return {
          label: 'Dropdown',
          tooltip:
            'This FormSG dropdown can be used as a list value in GatherSG Create/Update case.',
        }
      case 'file':
        return {
          label: 'File',
          tooltip:
            'This variable can be used as an attachment in Email by Postman action.',
        }
      case 'tile_row_id':
        return {
          label: 'Tile Row ID',
          tooltip: `This variable can be used in Tile's Update Single Row action`,
        }
      case 'approval':
        return {
          label: 'Approval',
          tooltip: 'This variable determines the approval status of this step',
        }
      case 'ai_response':
        return {
          label: 'AI response',
          tooltip: 'This is AI-generated. Check for errors before using it.',
        }
      default:
        return {
          label: null,
          tooltip: null,
        }
    }
  }, [type])

  if (!label) {
    return null
  }

  return (
    <Tooltip
      label={tooltip}
      placement="right"
      hasArrow
      motionProps={POPOVER_MOTION_PROPS}
    >
      <Tag size="xs" variant="outline">
        {label}
      </Tag>
    </Tooltip>
  )
}

export function VariableItem({
  variable,
  onClick,
  isLast,
  withViewButton,
  onViewButtonPreload,
  isViewButtonLoading,
}: {
  variable: Variable
  onClick?: (variable: Variable) => void
  isLast?: boolean
  withViewButton?: boolean
  onViewButtonPreload?: () => void
  isViewButtonLoading?: boolean
}): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)
  const shouldShowBottomBorder = !withViewButton && (onClick || isLast)

  const displayValue =
    variable.displayedValue ?? variable.value?.toString() ?? ''

  const isSuggestionVariable = onClick && !withViewButton

  // Check if text is overflowing after render
  useEffect(() => {
    if (variable.type === 'ai_response' && textRef.current && !isExpanded) {
      const element = textRef.current
      const isTextOverflowing =
        element.scrollHeight > element.clientHeight ||
        element.scrollWidth > element.clientWidth
      setIsOverflowing(isTextOverflowing)
    }
  }, [variable.type, isExpanded])

  // NOTE: we intentionally not show the toggle for suggestion variables
  const shouldShowToggle =
    variable.type === 'ai_response' && isOverflowing && !isSuggestionVariable

  return (
    <Box
      key={`suggestion-${variable.name}`}
      data-test="variable-suggestion-item"
      h={
        isSuggestionVariable
          ? SUGGESTION_VARIABLE_ITEM_HEIGHT
          : shouldShowToggle
          ? 'auto'
          : VARIABLE_ITEM_HEIGHT
      }
      maxH={
        isSuggestionVariable
          ? SUGGESTION_VARIABLE_ITEM_HEIGHT
          : shouldShowToggle
          ? undefined
          : VARIABLE_ITEM_HEIGHT
      }
      overflowY={shouldShowToggle && isExpanded ? 'visible' : 'hidden'}
      padding={isSuggestionVariable ? '0.5rem 1rem' : '1rem'}
      borderBottom={shouldShowBottomBorder ? undefined : '1px solid #EDEDED'}
      _hover={
        isSuggestionVariable
          ? {
              backgroundColor: 'secondary.50',
              cursor: 'pointer',
            }
          : undefined
      }
      _active={
        isSuggestionVariable
          ? {
              backgroundColor: 'secondary.100',
              cursor: 'pointer',
            }
          : undefined
      }
      // onClick doesn't work sometimes due to latency between mousedown and immediate mouseup event after
      onMouseDown={
        isSuggestionVariable
          ? () => {
              onClick(variable)
            }
          : undefined
      }
    >
      <Flex justifyContent="space-between" gap={4}>
        <Flex flexDir="column" minW={0}>
          <Flex alignItems="center" gap={2}>
            <Text
              textStyle="body-1"
              color="base.content.strong"
              display="flex"
              alignItems="center"
              gap={2}
              isTruncated
            >
              {variable.label ?? variable.name}{' '}
              <VariableTag type={variable.type} />
            </Text>
          </Flex>
          <Flex flexDirection="column" gap={1}>
            <Flex alignItems="center" gap={2}>
              <Text
                ref={textRef}
                textStyle="body-2"
                color="base.content.medium"
                whiteSpace={isExpanded ? 'pre-wrap' : 'nowrap'}
                overflow={isExpanded ? 'visible' : 'hidden'}
                textOverflow={isExpanded ? 'clip' : 'ellipsis'}
              >
                {displayValue.length ? (
                  displayValue
                ) : (
                  // padding right to ensure the 'y' is not cut off
                  <i style={{ opacity: 0.5, paddingRight: 2 }}>empty</i>
                )}
              </Text>
            </Flex>
            {shouldShowToggle && (
              <Text
                textStyle="body-2"
                color="primary.500"
                cursor="pointer"
                _hover={{ textDecoration: 'underline' }}
                onClick={(e) => {
                  e.stopPropagation()
                  setIsExpanded(!isExpanded)
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                }}
              >
                {isExpanded ? 'Show less' : 'Show more'}
              </Text>
            )}
          </Flex>
        </Flex>
        {onClick && withViewButton && (
          <Button
            variant="clear"
            onClick={() => onClick(variable)}
            onMouseEnter={onViewButtonPreload}
            onFocus={onViewButtonPreload}
            onPointerDown={onViewButtonPreload}
            isLoading={isViewButtonLoading}
          >
            View
          </Button>
        )}
      </Flex>
    </Box>
  )
}

interface VariablesListProps {
  variables: Variable[]
  onClick?: (variable: Variable) => void
  customStyles?: SystemStyleObject
  supportTableDisplay?: boolean
}

export default function VariablesList(props: VariablesListProps) {
  const { variables, onClick, supportTableDisplay } = props

  // Separate variables into default and collapsed categories
  const { defaultVariables, collapsedVariables } = useMemo(() => {
    if (!variables) {
      return { defaultVariables: [], collapsedVariables: [] }
    }

    const defaultVariables: Variable[] = []
    const collapsedVariables: Variable[] = []
    for (const variable of variables) {
      // virtualized list reserving height for items that render null --> add isHidden check also
      if (variable.isHiddenFromList || variable.isHidden) {
        continue
      }
      if (variable.isCollapsedByDefault) {
        collapsedVariables.push(variable)
      } else {
        defaultVariables.push(variable)
      }
    }
    return { defaultVariables, collapsedVariables }
  }, [variables])

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: defaultVariables.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () =>
      onClick ? SUGGESTION_VARIABLE_ITEM_HEIGHT : VARIABLE_ITEM_HEIGHT,
    measureElement: (element) => element.getBoundingClientRect().height,
    overscan: 50,
  })

  if (!variables || defaultVariables.length + collapsedVariables.length === 0) {
    return <></>
  }

  return (
    <Box
      data-test="variable-suggestion-group"
      maxH={64}
      overflowY="auto"
      p={onClick ? undefined : '1rem'}
      sx={props.customStyles}
      ref={parentRef}
    >
      <Box h={`${virtualizer.getTotalSize()}px`} w="100%" position="relative">
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const variable = defaultVariables[virtualItem.index]
          const isLast = virtualItem.index === defaultVariables.length - 1
          const isVariableWithModal = VARIABLES_WITH_MODALS.includes(
            variable.type ?? 'text',
          )

          return (
            <Box
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              position="absolute"
              top={0}
              left={0}
              width="100%"
              transform={`translateY(${virtualItem.start}px)`}
            >
              {isVariableWithModal ? (
                <VariableItemWithModal
                  variable={variable}
                  onClick={onClick}
                  supportTableDisplay={supportTableDisplay}
                />
              ) : variable.isHidden ? null : (
                <VariableItem
                  variable={variable}
                  onClick={onClick}
                  isLast={isLast}
                />
              )}
            </Box>
          )
        })}
      </Box>
      {collapsedVariables.length > 0 && (
        <Accordion allowMultiple border="transparent" py={2}>
          <AccordionItem p={0}>
            {({ isExpanded }) => (
              <>
                <AccordionPanel p={0} borderTop="1px solid #EDEDED">
                  {/* collapsed variables are not virtualized */}
                  {collapsedVariables.map((variable, index) => (
                    <VariableItem
                      key={`variable-${variable.name}-${index}`}
                      variable={variable}
                      onClick={onClick}
                      isLast={index === collapsedVariables.length - 1}
                    />
                  ))}
                </AccordionPanel>
                <AccordionButton
                  flex={1}
                  justifyContent="center"
                  borderRadius="md"
                >
                  <Box as="span">{isExpanded ? 'Show less' : 'Show more'}</Box>
                  <AccordionIcon />
                </AccordionButton>
              </>
            )}
          </AccordionItem>
        </Accordion>
      )}
    </Box>
  )
}

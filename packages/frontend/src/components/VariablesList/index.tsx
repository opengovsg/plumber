import { TDataOutMetadatumType } from '@plumber/types'

import { useMemo } from 'react'
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  type SystemStyleObject,
  Tag,
  Text,
  Tooltip,
} from '@chakra-ui/react'

import { type Variable } from '@/helpers/variables'
import { POPOVER_MOTION_PROPS } from '@/theme/constants'

function VariableTag({
  type,
}: {
  type: TDataOutMetadatumType | null
}): JSX.Element | null {
  const { label, tooltip } = useMemo(() => {
    switch (type) {
      case 'array':
        return {
          label: 'List',
          tooltip: 'This variable can be used in for-each loops (coming soon!)',
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

function VariableItem({
  variable,
  onClick,
  isLast,
}: {
  variable: Variable
  onClick?: (variable: Variable) => void
  isLast?: boolean
}): JSX.Element {
  return (
    <Box
      key={`suggestion-${variable.name}`}
      data-test="variable-suggestion-item"
      padding={onClick ? '0.5rem 1rem' : '1rem'}
      borderBottom={onClick || isLast ? undefined : '1px solid #EDEDED'}
      _hover={
        onClick
          ? {
              backgroundColor: 'secondary.50',
              cursor: 'pointer',
            }
          : undefined
      }
      _active={
        onClick
          ? {
              backgroundColor: 'secondary.100',
              cursor: 'pointer',
            }
          : undefined
      }
      // onClick doesn't work sometimes due to latency between mousedown and immediate mouseup event after
      onMouseDown={
        onClick
          ? () => {
              onClick(variable)
            }
          : undefined
      }
    >
      <Text
        textStyle="body-1"
        color="base.content.strong"
        display="flex"
        alignItems="center"
        gap={2}
      >
        {variable.label ?? variable.name} <VariableTag type={variable.type} />
      </Text>
      <Text textStyle="body-2" color="base.content.medium">
        {variable.displayedValue ?? variable.value?.toString() ?? ''}
      </Text>
    </Box>
  )
}

interface VariablesListProps {
  variables: Variable[]
  onClick?: (variable: Variable) => void
  customStyles?: SystemStyleObject
}

export default function VariablesList(props: VariablesListProps) {
  const { variables, onClick } = props

  // Separate variables into default and collapsed categories
  const { defaultVariables, collapsedVariables } = useMemo(() => {
    if (!variables) {
      return { defaultVariables: [], collapsedVariables: [] }
    }

    const defaultVariables: Variable[] = []
    const collapsedVariables: Variable[] = []
    for (const variable of variables) {
      if (variable.isCollapsedByDefault) {
        collapsedVariables.push(variable)
      } else {
        defaultVariables.push(variable)
      }
    }
    return { defaultVariables, collapsedVariables }
  }, [variables])

  if (!variables || variables.length === 0) {
    return <></>
  }

  return (
    <Box
      data-test="variable-suggestion-group"
      maxH={64}
      overflowY="auto"
      p={onClick ? undefined : '1rem'}
      sx={props.customStyles}
    >
      {defaultVariables.map((variable, index) => (
        <VariableItem
          key={`variable-${variable.name}-${index}`}
          variable={variable}
          onClick={onClick}
          isLast={index === defaultVariables.length - 1}
        />
      ))}
      {collapsedVariables.length > 0 && (
        <Accordion allowMultiple border="transparent" py={2}>
          <AccordionItem p={0}>
            {({ isExpanded }) => (
              <>
                <AccordionPanel p={0} borderTop="1px solid #EDEDED">
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

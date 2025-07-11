import { TDataOutMetadatumType } from '@plumber/types'

import { useMemo } from 'react'
import { IconType } from 'react-icons/lib'
import {
  Box,
  Flex,
  Icon,
  type SystemStyleObject,
  Tag,
  Text,
  Tooltip,
} from '@chakra-ui/react'

import { type Variable } from '@/helpers/variables'
import { POPOVER_MOTION_PROPS } from '@/theme/constants'

import TableVariableItem from './TableVariableItem'

function VariableTag({
  type,
}: {
  type: TDataOutMetadatumType | null
}): JSX.Element | null {
  const { label, tooltip } = useMemo(() => {
    switch (type) {
      case 'array':
      case 'table':
        return {
          label: 'List',
          tooltip: 'This variable can be used in the For-each action',
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

export function VariableItem({
  variable,
  onClick,
  isLast,
  withIcon,
}: {
  variable: Variable
  onClick?: (variable: Variable) => void
  isLast?: boolean
  withIcon?: IconType
}): JSX.Element {
  const shouldShowBottomBorder = !withIcon && (onClick || isLast)
  return (
    <Box
      key={`suggestion-${variable.name}`}
      data-test="variable-suggestion-item"
      padding={onClick && !withIcon ? '0.5rem 1rem' : '1rem'}
      borderBottom={shouldShowBottomBorder ? undefined : '1px solid #EDEDED'}
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
      <Flex alignItems="center" gap={2}>
        <Text
          textStyle="body-2"
          color="base.content.medium"
          textDecoration={withIcon ? 'underline' : undefined}
        >
          {variable.displayedValue ?? variable.value?.toString() ?? ''}
        </Text>
        {withIcon && <Icon as={withIcon} />}
      </Flex>
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
      {variables.map((variable, index) =>
        variable.type === 'table' ? (
          <TableVariableItem
            key={`variable-${variable.name}`}
            variable={variable}
            onClick={onClick}
          />
        ) : variable.isHidden ? null : (
          <VariableItem
            key={`variable-${variable.name}`}
            variable={variable}
            onClick={onClick}
            isLast={index === variables.length - 1}
          />
        ),
      )}
    </Box>
  )
}

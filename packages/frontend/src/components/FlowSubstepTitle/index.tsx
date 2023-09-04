import * as React from 'react'
import {
  BiChevronDown,
  BiChevronUp,
  BiSolidCheckCircle,
  BiSolidErrorCircle,
} from 'react-icons/bi'
import { Flex, Icon, Text } from '@chakra-ui/react'

import { ListItemButton } from './style'

type FlowSubstepTitleProps = {
  expanded?: boolean
  onClick: () => void
  title: string
  valid?: boolean | null
}

const validIcon = (
  <Icon
    boxSize={6}
    as={BiSolidCheckCircle}
    color="interaction.success.default"
  ></Icon>
)
const errorIcon = (
  <Icon
    boxSize={6}
    as={BiSolidErrorCircle}
    color="interaction.warning.default"
  ></Icon>
)

function FlowSubstepTitle(props: FlowSubstepTitleProps): React.ReactElement {
  const { expanded = false, onClick = () => null, valid = null, title } = props

  const hasValidation = valid !== null
  const validationStatusIcon = valid ? validIcon : errorIcon

  return (
    <ListItemButton
      onClick={onClick}
      selected={expanded}
      divider
      sx={{
        py: '0.75rem',
      }}
    >
      <Flex>
        {expanded ? (
          <Icon mr={2} mt={1} as={BiChevronUp}></Icon>
        ) : (
          <Icon mr={2} mt={1} as={BiChevronDown}></Icon>
        )}
        <Text textStyle="subhead-1">{title}</Text>
      </Flex>

      {hasValidation && validationStatusIcon}
    </ListItemButton>
  )
}

export default FlowSubstepTitle

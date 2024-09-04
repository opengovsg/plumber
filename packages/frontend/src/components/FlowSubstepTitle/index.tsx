import * as React from 'react'
import {
  BiChevronDown,
  BiChevronUp,
  BiSolidCheckCircle,
  BiSolidErrorCircle,
} from 'react-icons/bi'
import { Box, Divider, Flex, Icon, Text } from '@chakra-ui/react'

type FlowSubstepTitleProps = {
  expanded?: boolean
  onClick: () => void
  title: string
  valid?: boolean | null
  rightEl?: React.ReactElement
}

const validIcon = (
  <Icon
    boxSize={6}
    as={BiSolidCheckCircle}
    color="interaction.success.default"
    mr={4}
  />
)
const errorIcon = (
  <Icon boxSize={6} as={BiSolidErrorCircle} color="yellow.200" mr={4} />
)

function FlowSubstepTitle(props: FlowSubstepTitleProps): React.ReactElement {
  const {
    expanded = false,
    onClick = () => null,
    valid = null,
    title,
    rightEl,
  } = props

  const hasValidation = valid !== null
  const validationStatusIcon = valid ? validIcon : errorIcon

  return (
    <Box>
      <Flex
        onClick={onClick}
        bg={expanded ? 'interaction.muted.neutral.active' : 'white'}
        _hover={{ bg: 'interaction.muted.neutral.hover', cursor: 'pointer' }}
        justifyContent="space-between"
        pt={5}
        pb={5}
      >
        <Flex alignItems="center">
          <Box ml={4} mr={2}>
            {expanded ? <BiChevronUp /> : <BiChevronDown />}
          </Box>
          <Text textStyle="subhead-1">{title}</Text>
          {rightEl}
        </Flex>

        {hasValidation && validationStatusIcon}
      </Flex>
      <Divider borderColor="base.divider.medium"></Divider>
    </Box>
  )
}

export default FlowSubstepTitle

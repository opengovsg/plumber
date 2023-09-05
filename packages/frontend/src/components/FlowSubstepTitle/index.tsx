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
}

const validIcon = (
  <Icon
    boxSize={6}
    as={BiSolidCheckCircle}
    color="interaction.success.default"
    mr={4}
  ></Icon>
)
const errorIcon = (
  <Icon
    boxSize={6}
    as={BiSolidErrorCircle}
    color="interaction.warning.default"
    mr={4}
  ></Icon>
)

function FlowSubstepTitle(props: FlowSubstepTitleProps): React.ReactElement {
  const { expanded = false, onClick = () => null, valid = null, title } = props

  const hasValidation = valid !== null
  const validationStatusIcon = valid ? validIcon : errorIcon

  return (
    <Box>
      <Flex
        onClick={onClick}
        bg={expanded ? 'interaction.muted.main.active' : 'white'}
        _hover={{ bg: 'interaction.muted.main.hover', cursor: 'pointer' }}
        justifyContent="space-between"
        pt={5}
        pb={5}
      >
        <Flex alignItems="center">
          <Box ml={4} mr={2}>
            {expanded ? <BiChevronUp /> : <BiChevronDown />}
          </Box>
          <Text textStyle="subhead-1">{title}</Text>
        </Flex>

        {hasValidation && validationStatusIcon}
      </Flex>
      <Divider borderColor="base.divider.medium"></Divider>
    </Box>
  )
}

export default FlowSubstepTitle

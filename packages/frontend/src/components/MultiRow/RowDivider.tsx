import { Divider, Flex, Text } from '@chakra-ui/react'

export default function RowDivider() {
  return (
    <Flex alignItems="center">
      <Divider />
      <Text textStyle="subhead-3" mx={2.5}>
        And
      </Text>
      <Divider />
    </Flex>
  )
}

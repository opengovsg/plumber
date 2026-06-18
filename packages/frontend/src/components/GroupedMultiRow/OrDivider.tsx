import { Divider, Flex, Text } from '@chakra-ui/react'

/**
 * Divider shown between OR-groups (mirrors MultiRow's "And" RowDivider).
 */
export default function OrDivider() {
  return (
    <Flex alignItems="center" my={4}>
      <Divider />
      <Text textStyle="subhead-3" mx={2.5}>
        OR
      </Text>
      <Divider />
    </Flex>
  )
}

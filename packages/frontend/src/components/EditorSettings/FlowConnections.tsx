import { Flex, Text } from '@chakra-ui/react'

import ConnectionsTable from './FlowConnections/ConnectionsTable'
import { editorSettingsStyles as styles } from './styles'

export default function FlowConnections() {
  return (
    <Flex {...styles.editorSettingsWrapper} maxW="100%">
      <Text textStyle="h3-semibold">Connections</Text>
      <ConnectionsTable />
    </Flex>
  )
}

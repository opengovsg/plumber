import { Box, Flex, List, ListItem, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'
import { useContext } from 'react'
import { Link } from 'react-router-dom'

import * as URLS from '@/config/urls'
import { EditorSettingsContext } from '@/contexts/EditorSettings'

const FLOW_TRANSFER_WARNING_MESSAGES = [
  'The transfer is only complete when the new owner accepts.',
  "After the transfer, you'll become an editor of this Pipe.",
  'Linked connections will remain available only within this Pipe.',
]

export default function WarningInfobox() {
  const { flow } = useContext(EditorSettingsContext)

  const hasExcelStep = flow.steps.some((step) => step.appKey === 'm365-excel')

  return (
    <Infobox variant="warning" borderRadius="md" w="100%">
      <Flex flexDir="column" gap={2}>
        <Text textStyle="subhead-1">Before you transfer</Text>
        <List spacing={2} styleType="disc" pl={5}>
          {hasExcelStep && (
            <ListItem>
              <Flex flexDir="column" gap={2}>
                <Text textStyle="body-1">
                  This Pipe uses an M365 Excel connection. The new owner will
                  need to set it up manually.
                </Text>
                <Box bg="interaction.tinted.sub.hover" p={3} borderRadius="md">
                  <Text textStyle="body-2">
                    <Text as="span" fontWeight="medium">
                      Recommended:
                    </Text>{' '}
                    Download the linked file and send it to the new owner. They
                    can then upload it to their own Excel folder and reconnect.
                  </Text>
                </Box>
              </Flex>
            </ListItem>
          )}
          {FLOW_TRANSFER_WARNING_MESSAGES.map((message) => (
            <ListItem key={message}>
              <Text textStyle="body-1">{message}</Text>
            </ListItem>
          ))}
        </List>
        <Text mt={2}>
          <Link to={URLS.FLOW_EDITOR_CONNECTIONS(flow.id)}>
            <Text as="span" textStyle="subhead-1">
              Review connections
            </Text>
          </Link>{' '}
          before transferring.
        </Text>
      </Flex>
    </Infobox>
  )
}

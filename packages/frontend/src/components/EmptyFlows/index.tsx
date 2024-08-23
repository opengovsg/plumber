import {
  AbsoluteCenter,
  Box,
  Divider,
  Flex,
  Grid,
  Hide,
  Text,
  useDisclosure,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import NavigationDrawer from '@/components/Layout/NavigationDrawer'
import ApproveTransfersInfobox from '@/pages/Flows/components/ApproveTransfersInfobox'
import CreateFlowModal from '@/pages/Flows/components/CreateFlowModal'
import {
  ATTENDANCE_TAKING_ID,
  SCHEDULE_REMINDERS_ID,
  SEND_FOLLOW_UPS_ID,
  TEMPLATES,
} from '@/pages/Templates/templates-data'

import FlowTemplate from './FlowTemplate'

interface EmptyFlowsProps {
  count?: number
}

const TEMPLATE_IDS_TO_DISPLAY = [
  SEND_FOLLOW_UPS_ID,
  SCHEDULE_REMINDERS_ID,
  ATTENDANCE_TAKING_ID,
]

export default function EmptyFlows(props: EmptyFlowsProps) {
  const { count } = props

  const displayTemplates = TEMPLATES.filter((template) =>
    TEMPLATE_IDS_TO_DISPLAY.some((displayId) => displayId === template.id),
  )

  // for creation of flows
  const {
    isOpen: isCreateFlowModalOpen,
    onOpen: onCreateFlowModalOpen,
    onClose: onCreateFlowModalClose,
  } = useDisclosure()

  return (
    <>
      <Box px="10vw" py="10vh">
        {count === undefined || count === 0 ? (
          <></>
        ) : (
          <ApproveTransfersInfobox count={count} />
        )}

        <Flex>
          <Hide above="sm">
            <Box mt={-1.5}>
              <NavigationDrawer />
            </Box>
          </Hide>
          <Text textStyle="h4">
            Start creating a pipe from one of our templates below
          </Text>
        </Flex>

        <Grid
          gridTemplateColumns={{
            base: '1fr',
            md: '1fr 1fr',
            lg: '1fr 1fr 1fr',
          }}
          columnGap={4}
          rowGap={6}
          mt={4}
        >
          {displayTemplates.map((template) => (
            <FlowTemplate key={template.id} template={template} />
          ))}
        </Grid>

        <Box position="relative" my={8}>
          <Divider />
          <AbsoluteCenter>
            <Box bg="white" p={3}>
              <Text textStyle="subhead-1">OR</Text>
            </Box>
          </AbsoluteCenter>
        </Box>

        <Button w="100%" onClick={onCreateFlowModalOpen} variant="outline">
          Create from scratch
        </Button>
      </Box>

      {isCreateFlowModalOpen && (
        <CreateFlowModal onClose={onCreateFlowModalClose} />
      )}
    </>
  )
}

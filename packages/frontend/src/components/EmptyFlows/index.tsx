import { BiWinkSmile } from 'react-icons/bi'
import {
  AbsoluteCenter,
  As,
  Box,
  Divider,
  Flex,
  Grid,
  Hide,
  Icon,
  Text,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import NavigationDrawer from 'components/Layout/NavigationDrawer'
import ApproveTransfersInfobox from 'pages/Flows/components/ApproveTransfersInfobox'

import FlowTemplate, { FlowTemplateProps } from './FlowTemplate'

const flowTemplates: FlowTemplateProps[] = [
  {
    title: 'Notifications for form submission',
    description: 'Set up notifications when a new form submission comes in',
    link: 'https://guide.plumber.gov.sg/use-cases/notifications-for-formsg',
  },
  {
    title: 'Customised acknowledgements',
    description: `Send respondents’ customised acknowledgements based on their form responses`,
    link: 'https://guide.plumber.gov.sg/use-cases/email-acknowledgements-to-respondent',
  },
  {
    title: 'Attendance tracking',
    description: 'Track turnout for events',
    link: 'https://guide.plumber.gov.sg/use-cases/attendance-taking',
  },
]

interface EmptyFlowsProps {
  CreateFlowLink: As
  count?: number
}

export default function EmptyFlows(props: EmptyFlowsProps) {
  const { CreateFlowLink, count } = props
  return (
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
        <Text textStyle="h4" display="inline">
          {`You don't have any pipes, see what others are creating`}{' '}
          <Icon
            as={BiWinkSmile}
            verticalAlign="middle"
            color="primary.500"
            boxSize={8}
          />
        </Text>
      </Flex>
      <Grid mt={4} gridTemplateColumns="repeat(3, 1fr)" gap={4}>
        {flowTemplates.map(({ title, description, link }, index) => (
          <FlowTemplate
            key={index}
            title={title}
            description={description}
            link={link}
          />
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
      <Button w="100%" as={CreateFlowLink}>
        Create my own pipe
      </Button>
    </Box>
  )
}

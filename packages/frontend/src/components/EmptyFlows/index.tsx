import { BiWinkSmile } from 'react-icons/bi'
import {
  AbsoluteCenter,
  As,
  Box,
  Divider,
  Grid,
  Icon,
  Text,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import FlowTemplate, { FlowTemplateProps } from './FlowTemplate'

const flowTemplates: FlowTemplateProps[] = [
  {
    count: 999,
    title: 'Notifications for form submission',
    description: 'Set up notifications when a new form submission comes in',
    link: 'https://guide.plumber.gov.sg/use-cases/notifications-for-formsg',
  },
  {
    count: 145,
    title: 'Customised acknowledgements',
    description: `Send respondents’ customised acknowledgements based on their form responses`,
    link: 'https://guide.plumber.gov.sg/use-cases/email-acknowledgements-to-respondent',
  },
  {
    count: 145,
    title: 'Attendance tracking',
    description: 'Track turnout for events',
    link: 'https://guide.plumber.gov.sg/use-cases/attendance-taking',
  },
]

interface EmptyFlowsProps {
  CreateFlowLink: As
}

export default function EmptyFlows(props: EmptyFlowsProps) {
  const { CreateFlowLink } = props
  return (
    <Box px="10vw" py="10vh">
      <Text textStyle="h4" display="inline">
        {`You don't have any pipes, see what others are creating`}{' '}
        <Icon
          as={BiWinkSmile}
          verticalAlign="middle"
          color="primary.600"
          boxSize={8}
        />
      </Text>
      <Grid mt={4} gridTemplateColumns="repeat(3, 1fr)" gap={4}>
        {flowTemplates.map(({ count, title, description, link }, index) => (
          <FlowTemplate
            key={index}
            count={count}
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

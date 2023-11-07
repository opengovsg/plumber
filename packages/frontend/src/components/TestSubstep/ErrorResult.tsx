import { IStepError } from '@plumber/types'

import { Box, Text } from '@chakra-ui/react'
import { Badge, Infobox } from '@opengovsg/design-system-react'

interface ErrorResultProps {
  errorDetails: IStepError
}

const contactPlumberMessage =
  'If this error still persists, contact us at support@plumber.gov.sg.'

export default function ErrorResult(props: ErrorResultProps) {
  const { errorDetails } = props
  const { name, solution, position, action } = errorDetails
  return (
    <Infobox variant="error">
      <Box>
        <Badge
          mb={2}
          bg="interaction.critical-subtle.default"
          color="interaction.critical.default"
        >
          <Text>{`Step ${position}: ${action} error`}</Text>
        </Badge>

        <Text mb={0.5} textStyle="subhead-1">
          {name}
        </Text>

        <Text textStyle="body-1">
          {solution} {contactPlumberMessage}
        </Text>
      </Box>
    </Infobox>
  )
}

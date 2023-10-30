import { Box, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

export default function GenericErrorResult() {
  return (
    <Infobox variant="error">
      <Box>
        <Text mb={2} textStyle="subhead-1">
          We could not test this step
        </Text>

        <Text textStyle="body-1">
          Check if you have configured the steps above correctly and retest. If
          this error still persists, contact us at support@plumber.gov.sg.
        </Text>
      </Box>
    </Infobox>
  )
}

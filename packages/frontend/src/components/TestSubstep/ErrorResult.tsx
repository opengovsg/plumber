import { IStepError } from '@plumber/types'

import { useCallback, useState } from 'react'
import { Box, Collapse, Text } from '@chakra-ui/react'
import { Button, Infobox } from '@opengovsg/design-system-react'
import JSONViewer from 'components/JSONViewer'

interface ErrorResultProps {
  errorDetails: IStepError
}

const contactPlumberMessage =
  'If this error still persists, contact us at support@plumber.gov.sg.'

export default function ErrorResult(props: ErrorResultProps) {
  const { errorDetails } = props
  const [isOpen, setIsOpen] = useState(false)
  const toggleDropdown = useCallback(() => {
    setIsOpen((value) => !value)
  }, [])

  return (
    <Infobox variant="error">
      <Box>
        <Text mb={2} textStyle="subhead-1">
          {errorDetails.name}
        </Text>

        <Text textStyle="body-1">
          {errorDetails.solution} {contactPlumberMessage}
        </Text>

        {errorDetails.httpErrorDetails && (
          <Box mt={4}>
            <Button onClick={toggleDropdown} variant="outline" size="sm">
              View http error details
            </Button>
            <Collapse in={isOpen}>
              <JSONViewer
                data={JSON.parse(
                  JSON.stringify(errorDetails.httpErrorDetails, null, 2),
                )}
              ></JSONViewer>
            </Collapse>
          </Box>
        )}
      </Box>
    </Infobox>
  )
}

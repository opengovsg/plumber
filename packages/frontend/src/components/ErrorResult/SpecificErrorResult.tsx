import { IStepError } from '@plumber/types'

import { useCallback, useState } from 'react'
import { Box, Collapse, Text } from '@chakra-ui/react'
import { Badge, Button, Infobox } from '@opengovsg/design-system-react'
import JSONViewer from 'components/JSONViewer'

interface SpecificErrorResultProps {
  errorDetails: IStepError
  isTestRun: boolean
}

const contactPlumberMessage =
  'If this error still persists, contact us at support@plumber.gov.sg.'

export default function SpecificErrorResult(props: SpecificErrorResultProps) {
  const { errorDetails, isTestRun } = props
  const { name, solution, position, appName, details } = errorDetails
  const [isOpen, setIsOpen] = useState(false)
  const toggleDropdown = useCallback(() => {
    setIsOpen((value) => !value)
  }, [])

  return (
    <Infobox variant="error">
      <Box>
        {/* Actual executions will not need to show step position and app name */}
        {isTestRun && (
          <Badge
            mb={2}
            bg="interaction.critical-subtle.default"
            color="interaction.critical.default"
          >
            <Text>{`Step ${position}: ${appName} error`}</Text>
          </Badge>
        )}

        <Text mb={0.5} textStyle="subhead-1">
          {name}
        </Text>

        <Text textStyle="body-1">
          {solution} {contactPlumberMessage}{' '}
          {details && (
            <>
              <Button
                onClick={toggleDropdown}
                variant="link"
                size="sm"
                sx={{ textDecoration: 'underline' }}
              >
                View http error details below.
              </Button>

              <Box>
                <Collapse in={isOpen}>
                  <JSONViewer data={details}></JSONViewer>
                </Collapse>
              </Box>
            </>
          )}
        </Text>
      </Box>
    </Infobox>
  )
}

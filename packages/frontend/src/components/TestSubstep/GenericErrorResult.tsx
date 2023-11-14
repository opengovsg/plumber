import { IJSONObject } from '@plumber/types'

import { useCallback, useState } from 'react'
import { Box, Collapse, Text } from '@chakra-ui/react'
import { Button, Infobox } from '@opengovsg/design-system-react'
import JSONViewer from 'components/JSONViewer'

interface GenericErrorResultProps {
  errorDetails: IJSONObject
}

export default function GenericErrorResult(props: GenericErrorResultProps) {
  const { errorDetails } = props
  const [isOpen, setIsOpen] = useState(false)
  const toggleDropdown = useCallback(() => {
    setIsOpen((value) => !value)
  }, [])

  return (
    <Infobox variant="error">
      <Box>
        <Text mb={2} textStyle="subhead-1">
          We could not test this step
        </Text>

        <Text textStyle="body-1">
          Check if you have configured the steps above correctly and retest. If
          this error still persists, contact us at support@plumber.gov.sg.{' '}
          <Button
            onClick={toggleDropdown}
            variant="link"
            size="sm"
            sx={{ textDecoration: 'underline' }}
          >
            View error details below.
          </Button>
        </Text>

        <Box>
          <Collapse in={isOpen}>
            <JSONViewer data={errorDetails}></JSONViewer>
          </Collapse>
        </Box>
      </Box>
    </Infobox>
  )
}

import { IJSONObject } from '@plumber/types'

import { useCallback, useState } from 'react'
import { Box, Collapse, Text } from '@chakra-ui/react'
import { Button, Infobox } from '@opengovsg/design-system-react'

import JSONViewer from '@/components/JSONViewer'
import { SUPPORT_FORM_LINK } from '@/config/urls'

interface GenericErrorResultProps {
  errorDetails: IJSONObject
  isTestRun: boolean
}

export default function GenericErrorResult(props: GenericErrorResultProps) {
  const { errorDetails, isTestRun } = props
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
          {`Check if you have configured ${
            isTestRun ? 'the steps above' : 'this step'
          } correctly and retest. If
          this error still persists, contact us at `}
          <Text as="a" href={SUPPORT_FORM_LINK} target="_blank">
            {SUPPORT_FORM_LINK}
          </Text>
          .
        </Text>
        <Button
          onClick={toggleDropdown}
          variant="link"
          size="sm"
          sx={{ textDecoration: 'underline' }}
        >
          View error details below.
        </Button>

        <Box>
          <Collapse in={isOpen}>
            <JSONViewer data={errorDetails}></JSONViewer>
          </Collapse>
        </Box>
      </Box>
    </Infobox>
  )
}

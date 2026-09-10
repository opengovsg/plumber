import { Box, Collapse } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import { IJSONObject } from '@plumber/types'
import { useCallback, useState } from 'react'

import JSONViewer from '@/components/JSONViewer'

interface ErrorDetailsCollapseProps {
  details: IJSONObject
  buttonText?: string
}

export default function ErrorDetailsCollapse(props: ErrorDetailsCollapseProps) {
  const { details, buttonText = 'View error details below.' } = props
  const [isOpen, setIsOpen] = useState(false)

  const toggleDropdown = useCallback(() => {
    setIsOpen((value) => !value)
  }, [])

  return (
    <>
      <Button
        onClick={toggleDropdown}
        variant="link"
        size="sm"
        sx={{ textDecoration: 'underline' }}
        mt={2}
      >
        {buttonText}
      </Button>

      <Box>
        <Collapse in={isOpen}>
          <JSONViewer data={details} />
        </Collapse>
      </Box>
    </>
  )
}

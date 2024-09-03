import { useCallback, useContext, useRef, useState } from 'react'
import { BiHelpCircle } from 'react-icons/bi'
import { Box, Icon, Tooltip } from '@chakra-ui/react'

import { SINGLE_STEP_TEST_SHOW_BEFORE_FLAG } from '@/config/flags'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import * as localStorage from '@/helpers/storage'
import useAuthentication from '@/hooks/useAuthentication'

const SINGLE_STEP_TEST_STOP_PULSATE_STORAGE_KEY =
  'single_step_test_stop_pulsate'

function TestSubstepTitleTooltip() {
  const { currentUser } = useAuthentication()
  const { flags } = useContext(LaunchDarklyContext)

  const [pulsate, setPulsate] = useState(
    localStorage.getItem(SINGLE_STEP_TEST_STOP_PULSATE_STORAGE_KEY) !== 'true',
  )

  /**
   * Stop puslating after 1 second of hover
   */
  const hoverTimeoutRef = useRef<NodeJS.Timeout>()
  const handleMouseEnter = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(SINGLE_STEP_TEST_STOP_PULSATE_STORAGE_KEY, 'true')
      setPulsate(false)
    }, 1000)
  }, [])
  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimeoutRef.current)
  }, [])

  /**
   * We only want to show popover for users created before a certain time
   */
  const shouldShowTooltip =
    flags?.[SINGLE_STEP_TEST_SHOW_BEFORE_FLAG] &&
    currentUser &&
    +currentUser.createdAt < flags[SINGLE_STEP_TEST_SHOW_BEFORE_FLAG]

  if (!shouldShowTooltip) {
    return null
  }

  return (
    <Tooltip
      label={
        <span>
          <b>New behaviour:</b> The test button now only tests this step, rather
          than all steps up to this point
        </span>
      }
      placement="right-start"
      gutter={0}
      hasArrow
    >
      <Box
        boxSize="18px"
        ml={2}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        cursor="help"
      >
        <Icon
          as={BiHelpCircle}
          boxSize="inherit"
          sx={{
            borderRadius: '50%',
            animation: pulsate ? 'pulse 2s infinite' : undefined,
          }}
        />
      </Box>
    </Tooltip>
  )
}

export default TestSubstepTitleTooltip

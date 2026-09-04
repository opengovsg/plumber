import { Box, Spinner } from '@chakra-ui/react'
import { useContext } from 'react'

import { useIfThenV1Initializer } from '@/helpers/toolbox'

import { FlowStepConfigurationContext } from './FlowStepConfigurationContext'

export default function LoadingOverlay(): JSX.Element {
  const { modalState } = useContext(FlowStepConfigurationContext)
  const { isLoading } = modalState
  const [_, isInitializingIfThen] = useIfThenV1Initializer()

  const isModalLoading = isLoading || isInitializingIfThen

  if (!isModalLoading) {
    return <></>
  }

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="rgba(255, 255, 255, 0.8)"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Spinner size="xl" color="primary.500" thickness="4px" />
    </Box>
  )
}

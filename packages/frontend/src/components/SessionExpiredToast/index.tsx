import { Flex, Text } from '@chakra-ui/react'
import { Button, Infobox } from '@opengovsg/design-system-react'

import { redirectToLogin } from '@/helpers/redirectToLogin'

/**
 * Shared by every source that can detect an expired session (GraphQL and the
 * REST chat API), so a single expiry can't stack duplicate toasts.
 */
export const SESSION_EXPIRED_TOAST_ID = 'session-expired'

export default function SessionExpiredToast(): React.ReactElement {
  return (
    <Infobox
      alignItems="center"
      variant="warning"
      justifyContent="space-between"
      borderRadius="md"
      border="1px solid"
      w="500px"
      maxW="90vw"
      borderColor="interaction.warning.default"
      style={{
        padding: '0.5rem 1rem',
      }}
    >
      <Flex w="100%" justifyContent="space-between" alignItems="center">
        <Text>Session expired. Please login again.</Text>
        <Button
          colorScheme="yellow"
          variant="outline"
          size="sm"
          onClick={redirectToLogin}
        >
          Login
        </Button>
      </Flex>
    </Infobox>
  )
}

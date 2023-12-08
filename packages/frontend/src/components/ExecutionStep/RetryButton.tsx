import { useState } from 'react'
import { BiErrorCircle, BiRedo } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { HStack, Icon, Text } from '@chakra-ui/react'
import { Button, useToast } from '@opengovsg/design-system-react'
import { RETRY_EXECUTION_STEP } from 'graphql/mutations/retry-execution-step'

interface RetryButtonProps {
  executionStepId: string
}

const retryIcon = <Icon boxSize={6} as={BiRedo} />

const RetryButton = ({ executionStepId }: RetryButtonProps) => {
  const [isRetrySuccessful, setIsRetrySuccessful] = useState<boolean | null>(
    null,
  )
  const toast = useToast()
  const retrySuccessMessage =
    'Retry has been enqueued. Please reload your page after a few seconds to see updated status.'

  const [retryExecutionStep] = useMutation(RETRY_EXECUTION_STEP, {
    variables: {
      input: {
        executionStepId,
      },
    },
    onCompleted: () => {
      toast({
        title: retrySuccessMessage,
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'bottom-right',
      })
      setIsRetrySuccessful(true)
    },
    onError: () => {
      setIsRetrySuccessful(false)
    },
  })

  if (isRetrySuccessful == null) {
    return (
      <Button
        variant="clear"
        leftIcon={retryIcon}
        onClick={() => retryExecutionStep()}
      >
        Retry
      </Button>
    )
  } else {
    return (
      <HStack
        px={4}
        color={
          isRetrySuccessful
            ? 'interaction.success.default'
            : 'interaction.critical.default'
        }
      >
        <Icon as={BiErrorCircle} boxSize={6} />
        <Text textStyle="subhead-1">
          {isRetrySuccessful ? 'Retry started' : 'Retry failed'}
        </Text>
      </HStack>
    )
  }
}

export default RetryButton

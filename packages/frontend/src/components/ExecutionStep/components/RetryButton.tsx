import { useState } from 'react'
import { BiErrorCircle, BiRedo } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { HStack, Icon, Text } from '@chakra-ui/react'
import { Button, useToast } from '@opengovsg/design-system-react'

import client from '@/graphql/client'
import { RETRY_EXECUTION_STEP } from '@/graphql/mutations/retry-execution-step'
import { GET_EXECUTION_STEPS } from '@/graphql/queries/get-execution-steps'

interface RetryButtonProps {
  executionStepId: string
  customButtonText?: string
}

const retryIcon = <Icon boxSize={6} as={BiRedo} />

const RetryButton = ({
  executionStepId,
  customButtonText,
}: RetryButtonProps) => {
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

      // reload page after short delay because the job is retrying
      setTimeout(() => {
        client.refetchQueries({
          include: [GET_EXECUTION_STEPS],
        })
      }, 3000)
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
        {customButtonText ?? 'Retry'}
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

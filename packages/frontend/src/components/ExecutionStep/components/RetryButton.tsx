import { useState } from 'react'
import { BiErrorCircle, BiPlay, BiRedo } from 'react-icons/bi'
import { useMutation } from '@apollo/client'
import { HStack, Icon, Text } from '@chakra-ui/react'
import { Button, useToast } from '@opengovsg/design-system-react'

import client from '@/graphql/client'
import { RETRY_EXECUTION_STEP } from '@/graphql/mutations/retry-execution-step'
import { GET_EXECUTION_STEPS } from '@/graphql/queries/get-execution-steps'

export type RetryVariant = 'retry' | 'resume'

interface VariantConfig {
  defaultText: string
  successMessage: string
  icon: JSX.Element
  successText: string
  failureText: string
}

const variantConfigs: Record<RetryVariant, VariantConfig> = {
  retry: {
    defaultText: 'Retry',
    successMessage:
      'Retry has been enqueued. Your page should reload after a few seconds with the updated status.',
    icon: <Icon boxSize={6} as={BiRedo} />,
    successText: 'Retry started',
    failureText: 'Retry failed',
  },
  resume: {
    defaultText: 'Resume',
    successMessage:
      'Resume has been enqueued. Your page should reload after a few seconds with the updated status.',
    icon: <Icon boxSize={6} as={BiPlay} />,
    successText: 'Resume started',
    failureText: 'Resume failed',
  },
}

interface RetryButtonProps {
  executionStepId: string
  customButtonText?: string
  variant?: RetryVariant
}

const RetryButton = ({
  executionStepId,
  customButtonText,
  variant = 'retry',
}: RetryButtonProps) => {
  const [isRetrySuccessful, setIsRetrySuccessful] = useState<boolean | null>(
    null,
  )
  const toast = useToast()
  const config = variantConfigs[variant]

  const [retryExecutionStep] = useMutation(RETRY_EXECUTION_STEP, {
    variables: {
      input: {
        executionStepId,
      },
    },
    onCompleted: () => {
      toast({
        title: config.successMessage,
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
        leftIcon={config.icon}
        onClick={() => retryExecutionStep()}
      >
        {customButtonText ?? config.defaultText}
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
          {isRetrySuccessful ? config.successText : config.failureText}
        </Text>
      </HStack>
    )
  }
}

export default RetryButton

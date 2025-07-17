import { IExecution } from '@plumber/types'

import { useCallback, useContext, useState } from 'react'
import { TbArrowForwardUpDouble } from 'react-icons/tb'
import { useMutation } from '@apollo/client'
import { Icon } from '@chakra-ui/react'
import { Button, Spinner, useToast } from '@opengovsg/design-system-react'

import { BULK_RETRY_EXECUTIONS_FLAG } from '@/config/flags'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import { BULK_RETRY_ITERATIONS } from '@/graphql/mutations/bulk-retry-iterations'

interface RetryAllIterationsButtonProps {
  execution: IExecution
}

export const RetryAllIterationsButton = ({
  execution,
}: RetryAllIterationsButtonProps) => {
  const executionId = execution.id
  const { flags } = useContext(LaunchDarklyContext)
  const toast = useToast()
  const [isBulkRetrying, setIsBulkRetrying] = useState(false)
  const [hasBulkRetried, setHasBulkRetried] = useState(false)

  const [bulkRetryIterations] = useMutation(BULK_RETRY_ITERATIONS)
  const onBulkRetry = useCallback(async () => {
    try {
      setIsBulkRetrying(true)
      let message = `Plumber has started retrying all ${'failed items for this execution'}. Please check this page after a while to see updated status.`

      if (!executionId) {
        throw new Error('Flow ID or execution ID is required')
      }

      const result = await bulkRetryIterations({
        variables: {
          input: {
            executionId: executionId,
          },
        },
      })

      if (result.data?.bulkRetryIterations?.numFailedIterations === 0) {
        message = 'Plumber did not find any failed items to retry.'
      } else if (!result.data?.bulkRetryIterations?.allSuccessfullyRetried) {
        message =
          'Plumber was unable to retry some failed items. Please manually retry the failed items.'
      }

      toast({
        title: message,
        status: 'info',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
    } finally {
      setIsBulkRetrying(false)
      setHasBulkRetried(true)
    }
  }, [toast, executionId, bulkRetryIterations])

  if (!flags?.[BULK_RETRY_EXECUTIONS_FLAG]) {
    return null
  }

  return (
    <Button
      variant="clear"
      leftIcon={<Icon boxSize={6} as={TbArrowForwardUpDouble} />}
      isLoading={isBulkRetrying}
      isDisabled={hasBulkRetried}
      spinner={<Spinner fontSize={24} />}
      size="md"
      onClick={onBulkRetry}
    >
      Retry all failed items
    </Button>
  )
}

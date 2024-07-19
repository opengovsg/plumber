import { IExecution } from '@plumber/types'

import { useCallback, useContext, useState } from 'react'
import { TbArrowForwardUpDouble } from 'react-icons/tb'
import { useMutation } from '@apollo/client'
import { Icon } from '@chakra-ui/react'
import { Button, Spinner, useToast } from '@opengovsg/design-system-react'

import { BULK_RETRY_EXECUTIONS_FLAG } from '@/config/flags'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'
import { BULK_RETRY_EXECUTIONS } from '@/graphql/mutations/bulk-retry-executions'

interface RetryAllButtonProps {
  execution: IExecution
}

export const RetryAllButton = ({ execution }: RetryAllButtonProps) => {
  const flowId = execution.flow?.id
  const { flags } = useContext(LaunchDarklyContext)
  const toast = useToast()
  const [isBulkRetrying, setIsBulkRetrying] = useState(false)
  const [hasBulkRetried, setHasBulkRetried] = useState(false)
  const [bulkRetryExecutions] = useMutation(BULK_RETRY_EXECUTIONS)
  const onBulkRetryExecutions = useCallback(async () => {
    setIsBulkRetrying(true)
    try {
      const result = await bulkRetryExecutions({
        variables: {
          input: {
            flowId: flowId ?? '',
          },
        },
      })
      let message =
        'Plumber has started retrying all failures for this pipe. Please check the executions page after a while to see updated status.'
      if (result.data?.bulkRetryExecutions?.numFailedExecutions === 0) {
        message = 'Plumber did not find any failed executions to retry.'
      } else if (!result.data?.bulkRetryExecutions?.allSuccessfullyRetried) {
        message =
          'Plumber was unable to retry some failed executions. Please manually retry the failed step.'
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
  }, [flowId, bulkRetryExecutions, toast])

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
      onClick={onBulkRetryExecutions}
    >
      Retry all failures for this pipe
    </Button>
  )
}

import { IFlow } from '@plumber/types'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'
import { Flex, Skeleton, Stack, Text } from '@chakra-ui/react'
import { Menu, useToast } from '@opengovsg/design-system-react'
import { UPDATE_FLOW_CONFIG } from 'graphql/mutations/update-flow-config'
import { GET_FLOW } from 'graphql/queries/get-flow'

enum Frequency {
  Once = 'once_per_day',
  Always = 'always',
}

const frequencyOptions = [
  {
    label: 'First error on this pipe, one email notification per day',
    value: Frequency.Once,
  },
  {
    label: 'Each error on this pipe',
    value: Frequency.Always,
  },
]

const defaultFrequency = Frequency.Once

export default function Notifications() {
  const { flowId } = useParams()
  const [frequency, setFrequency] = useState(defaultFrequency)
  const { data, loading } = useQuery(GET_FLOW, { variables: { id: flowId } })
  const flow: IFlow = data?.getFlow
  const [updateFlowConfig] = useMutation(UPDATE_FLOW_CONFIG)
  const toast = useToast()

  const onFlowConfigUpdate = useCallback(
    async (frequency: Frequency) => {
      await updateFlowConfig({
        variables: {
          input: {
            id: flowId,
            notificationFrequency: frequency,
          },
        },
        optimisticResponse: {
          updateFlowConfig: {
            __typename: 'Flow',
            id: flow?.id,
            config: {
              errorConfig: {
                notificationFrequency: frequency,
              },
            },
          },
        },
      })

      const displayLabel = frequencyOptions
        .find((option) => option.value === frequency)
        ?.label.toLowerCase()

      toast({
        title: `You will now receive an email notification for ${displayLabel}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
    },
    [flow?.id, flowId, updateFlowConfig, toast],
  )

  const handleClick = useCallback(
    (frequencyOption: Frequency) => {
      // only update flow config if a different option is selected
      if (frequencyOption !== frequency) {
        setFrequency(frequencyOption)
        onFlowConfigUpdate(frequencyOption)
      }
    },
    [onFlowConfigUpdate, frequency],
  )

  useEffect(() => {
    // Retrieve frequency setting if config was set previously, else set default frequency in config
    if (!flow) {
      return
    }
    if (flow.config?.errorConfig?.notificationFrequency) {
      setFrequency(flow.config.errorConfig.notificationFrequency as Frequency)
    } else {
      onFlowConfigUpdate(defaultFrequency)
    }
  }, [flow, onFlowConfigUpdate])

  const frequencyLabel = useMemo(
    () => frequencyOptions.find((option) => option.value === frequency)?.label,
    [frequency],
  )

  return (
    <Flex
      py={{ base: '2rem', md: '3rem' }}
      px={{ base: '1.5rem', md: '5rem' }}
      flexDir="column"
      gap={4}
    >
      <Text textStyle="h3-semibold" mb={6}>
        Email notification settings
      </Text>
      <Stack>
        <Text textStyle="h6">Error notification</Text>
        <Text textStyle="body-1">
          These are the notifications that Plumber sends when there are errors
          in your pipe.
        </Text>
      </Stack>
      <Stack>
        <Text textStyle="subhead-1">Frequency</Text>
        <Menu isStretch>
          <Menu.Button variant="outline" colorScheme="secondary">
            <Skeleton isLoaded={!loading}>
              <Text
                textStyle="body-1"
                color="base.content.default"
                whiteSpace="nowrap"
                overflow="hidden"
                textOverflow="ellipsis"
              >
                {frequencyLabel}
              </Text>
            </Skeleton>
          </Menu.Button>
          <Menu.List>
            {frequencyOptions.map((option, index) => (
              <Menu.Item key={index} onClick={() => handleClick(option.value)}>
                {option.label}
              </Menu.Item>
            ))}
          </Menu.List>
        </Menu>
      </Stack>
    </Flex>
  )
}

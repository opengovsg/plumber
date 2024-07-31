import { useCallback, useContext, useMemo } from 'react'
import { useMutation } from '@apollo/client'
import { Flex, Skeleton, Stack, Text } from '@chakra-ui/react'
import { Menu, useToast } from '@opengovsg/design-system-react'

import { EditorSettingsContext } from '@/contexts/EditorSettings'
import { UPDATE_FLOW_CONFIG } from '@/graphql/mutations/update-flow-config'

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

const DEFAULT_FREQUENCY = Frequency.Once

export default function Notifications() {
  const { flow } = useContext(EditorSettingsContext)

  const frequency =
    flow?.config?.errorConfig?.notificationFrequency ?? DEFAULT_FREQUENCY
  const [updateFlowConfig] = useMutation(UPDATE_FLOW_CONFIG)
  const toast = useToast()

  const onFlowConfigUpdate = useCallback(
    async (frequency: Frequency) => {
      await updateFlowConfig({
        variables: {
          input: {
            id: flow.id,
            notificationFrequency: frequency,
          },
        },
        optimisticResponse: {
          updateFlowConfig: {
            __typename: 'Flow',
            id: flow.id,
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
    [flow.id, updateFlowConfig, toast],
  )

  const handleClick = useCallback(
    (frequencyOption: Frequency) => {
      // only update flow config if a different option is selected
      if (frequencyOption !== frequency) {
        onFlowConfigUpdate(frequencyOption)
      }
    },
    [onFlowConfigUpdate, frequency],
  )

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
            <Skeleton isLoaded={!!flow}>
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

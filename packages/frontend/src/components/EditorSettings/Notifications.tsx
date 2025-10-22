import { NotificationRecipients } from '@plumber/types'

import { useCallback, useContext } from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { useMutation } from '@apollo/client'
import { Flex, FormControl, Skeleton, Stack, Text } from '@chakra-ui/react'
import { Button, Checkbox, useToast } from '@opengovsg/design-system-react'

import Form from '@/components/Form'
import { SingleSelect } from '@/components/SingleSelect'
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

function NotificationFormFields() {
  const { flow } = useContext(EditorSettingsContext)
  const hasCollaborators =
    flow?.collaborators?.length && flow?.collaborators?.length > 1
  const isReadOnly = flow?.role === 'viewer'

  const {
    control,
    register,
    formState: { isDirty },
  } = useFormContext()

  return (
    <Stack gap={2}>
      <Text textStyle="subhead-1">Frequency</Text>
      <FormControl key="frequency">
        <Skeleton isLoaded={!!flow}>
          <Controller
            name="frequency"
            control={control}
            render={({ field: { onChange, value, name } }) => (
              <SingleSelect
                items={frequencyOptions}
                isSearchable={false}
                onChange={onChange}
                value={value}
                name={name}
                isClearable={false}
                colorScheme="secondary"
                isDisabled={isReadOnly}
              />
            )}
          />
        </Skeleton>
      </FormControl>
      {hasCollaborators && (
        <Stack gap={0}>
          <Text textStyle="subhead-1">Notify collaborators</Text>
          <Text textStyle="body-1">
            Collaborators will be CC-ed by default.
          </Text>
          <FormControl key="editors">
            <Checkbox {...register('notifyEditors')} isDisabled={isReadOnly}>
              Notify editor(s)
            </Checkbox>
          </FormControl>
          <FormControl key="viewers">
            <Checkbox {...register('notifyViewers')} isDisabled={isReadOnly}>
              Notify viewer(s)
            </Checkbox>
          </FormControl>
        </Stack>
      )}
      <Button
        size="sm"
        w="fit-content"
        type="submit"
        isDisabled={!isDirty || isReadOnly}
      >
        {isDirty ? 'Save' : 'Saved'}
      </Button>
    </Stack>
  )
}

export default function Notifications() {
  const { flow } = useContext(EditorSettingsContext)

  const frequency =
    flow?.config?.errorConfig?.notificationFrequency ?? DEFAULT_FREQUENCY
  const notificationRecipients =
    flow?.config?.errorConfig?.notificationRecipients ?? []

  const [updateFlowConfig] = useMutation(UPDATE_FLOW_CONFIG)
  const toast = useToast()

  // Empty array or no recipients = notify everyone (both checked)
  const notifyEveryone =
    !notificationRecipients || notificationRecipients.length === 0

  const defaultValues = {
    frequency,
    notifyEditors: notifyEveryone || notificationRecipients.includes('editor'),
    notifyViewers: notifyEveryone || notificationRecipients.includes('viewer'),
  }

  const onFlowConfigUpdate = useCallback(
    async (
      frequency: Frequency,
      newNotificationRecipients: NotificationRecipients[],
    ) => {
      await updateFlowConfig({
        variables: {
          input: {
            id: flow.id,
            notificationFrequency: frequency,
            ...(newNotificationRecipients.length > 0
              ? { notificationRecipients: newNotificationRecipients }
              : {}),
          },
        },
        optimisticResponse: {
          updateFlowConfig: {
            __typename: 'Flow',
            id: flow.id,
            config: {
              errorConfig: {
                notificationFrequency: frequency,
                ...(newNotificationRecipients.length > 0
                  ? { notificationRecipients: newNotificationRecipients }
                  : {}),
              },
            },
          },
        },
      })

      toast({
        title: `Notifications settings saved!`,
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
    },
    [flow.id, updateFlowConfig, toast],
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
        <Form
          defaultValues={defaultValues}
          onSubmit={(data: any) => {
            const newNotificationRecipients =
              data.notifyEditors && data.notifyViewers
                ? [] // Both selected = notify everyone (default)
                : [
                    ...(data.notifyEditors ? ['editor'] : []),
                    ...(data.notifyViewers ? ['viewer'] : []),
                  ]

            onFlowConfigUpdate(
              data.frequency as Frequency,
              newNotificationRecipients as NotificationRecipients[],
            )
          }}
        >
          <NotificationFormFields />
        </Form>
      </Stack>
    </Flex>
  )
}

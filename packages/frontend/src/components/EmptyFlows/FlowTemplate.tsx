import type { IJSONObject } from '@plumber/types'

import { useCallback } from 'react'
import { BiRightArrowAlt } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { Box, Card, CardBody, CardFooter, Flex, Text } from '@chakra-ui/react'
import { Button, useToast } from '@opengovsg/design-system-react'

import * as URLS from '@/config/urls'
import type { AppEventKeyPair, Template } from '@/graphql/__generated__/graphql'
import { CREATE_TEMPLATED_FLOW } from '@/graphql/mutations/create-templated-flow'
import { FALLBACK_ICON, TEMPLATE_ICONS_MAP } from '@/helpers/flow-templates'

export interface FlowTemplateProps {
  template: Template
}

export default function FlowTemplate(props: FlowTemplateProps) {
  const { template } = props
  const { id, name, description, steps } = template
  const navigate = useNavigate()
  const toast = useToast()

  const [createTemplatedFlow, { loading }] = useMutation(CREATE_TEMPLATED_FLOW)
  const onCreateTemplatedFlow = useCallback(async () => {
    // Simply sanity check: Template steps were not associated with the template
    if (steps.length === 0) {
      toast({
        title: `The template is invalid, please contact support@plumber.gov.sg`,
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
      return
    }

    // trigger or action could be null due to if-then
    const trigger: AppEventKeyPair = {
      appKey: steps[0]?.appKey ?? '',
      eventKey: steps[0]?.eventKey ?? '',
    }

    const actions: AppEventKeyPair[] = []
    const parametersList: IJSONObject[] = [steps[0]?.parameters ?? {}]
    for (let i = 1; i < steps.length; i++) {
      actions.push({
        appKey: steps[i]?.appKey ?? '',
        eventKey: steps[i]?.eventKey ?? '',
      })
      parametersList.push(steps[i]?.parameters ?? {})
    }

    const response = await createTemplatedFlow({
      variables: {
        input: {
          flowName: name,
          trigger,
          actions,
          parametersList,
          templateId: id,
        },
      },
    })
    navigate(URLS.FLOW(response.data?.createTemplatedFlow?.id))
  }, [toast, createTemplatedFlow, id, name, steps, navigate])

  return (
    <Card variant="outline">
      <CardBody>
        <Box bg="secondary.100" p={2} w="2.5rem" borderRadius="0.25rem">
          {TEMPLATE_ICONS_MAP[name] ?? FALLBACK_ICON}
        </Box>

        <Flex flexDir="column" gap={2} mt={2}>
          <Text textStyle="subhead-1">{name}</Text>
          <Text textStyle="body-2">{description}</Text>
        </Flex>
      </CardBody>

      <CardFooter>
        <Button
          rightIcon={<BiRightArrowAlt style={{ marginLeft: '-0.25rem' }} />}
          variant="link"
          onClick={onCreateTemplatedFlow}
          isLoading={loading}
        >
          <Text textStyle="caption-1">Use template</Text>
        </Button>
      </CardFooter>
    </Card>
  )
}

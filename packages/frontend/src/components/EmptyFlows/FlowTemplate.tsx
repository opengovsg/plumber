import { useCallback } from 'react'
import { BiRightArrowAlt } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import { Box, Card, CardBody, CardFooter, Flex, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import * as URLS from '@/config/urls'
import type { Template } from '@/graphql/__generated__/graphql'
import { CREATE_TEMPLATED_FLOW } from '@/graphql/mutations/create-templated-flow'
import { TemplateIcon } from '@/helpers/flow-templates'

export interface FlowTemplateProps {
  template: Template
}

export default function FlowTemplate(props: FlowTemplateProps) {
  const { template } = props
  const { id, name, description, iconName } = template
  const navigate = useNavigate()

  const [createTemplatedFlow, { loading }] = useMutation(CREATE_TEMPLATED_FLOW)
  const onCreateTemplatedFlow = useCallback(async () => {
    const response = await createTemplatedFlow({
      variables: {
        input: {
          templateId: id,
        },
      },
    })
    navigate(URLS.FLOW(response.data?.createTemplatedFlow?.id))
  }, [createTemplatedFlow, id, navigate])

  return (
    <Card variant="outline">
      <CardBody>
        <Box bg="secondary.100" p={2} w="2.5rem" borderRadius="0.25rem">
          <TemplateIcon iconName={iconName} />
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

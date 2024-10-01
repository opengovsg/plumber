import type { ITemplate } from '@plumber/types'

import { BiRightArrowAlt } from 'react-icons/bi'
import { useNavigate } from 'react-router-dom'
import { Box, Card, CardBody, CardFooter, Flex, Text } from '@chakra-ui/react'
import { Badge, Button } from '@opengovsg/design-system-react'

import * as URLS from '@/config/urls'
import { TemplateIcon } from '@/helpers/flow-templates'

export interface FlowTemplateProps {
  template: ITemplate
}

export default function FlowTemplate(props: FlowTemplateProps) {
  const { template } = props
  const { id, name, description, iconName, tags } = template
  const navigate = useNavigate()
  const isDemoTemplate = tags && tags.some((tag) => tag === 'demo')

  return (
    <Card variant="outline">
      <CardBody>
        <Flex alignItems="center" gap={4}>
          <Box bg="secondary.100" p={2} w="2.5rem" borderRadius="0.25rem">
            <TemplateIcon iconName={iconName} />
          </Box>
          {isDemoTemplate && (
            <Badge bg="secondary.100" color="secondary.500">
              Demo
            </Badge>
          )}
        </Flex>

        <Flex flexDir="column" gap={2} mt={2}>
          <Text textStyle="subhead-1">{name}</Text>
          <Text textStyle="body-2">{description}</Text>
        </Flex>
      </CardBody>

      <CardFooter>
        <Button
          rightIcon={<BiRightArrowAlt style={{ marginLeft: '-0.25rem' }} />}
          variant="link"
          onClick={() => navigate(URLS.TEMPLATE(id))}
        >
          <Text textStyle="caption-1">Use template</Text>
        </Button>
      </CardFooter>
    </Card>
  )
}

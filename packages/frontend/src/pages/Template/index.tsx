import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client'
import {
  Box,
  Flex,
  Hide,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'

import * as URLS from '@/config/urls'
import type { Template } from '@/graphql/__generated__/graphql'
import { CREATE_TEMPLATED_FLOW } from '@/graphql/mutations/create-templated-flow'
import { TemplateIcon } from '@/helpers/flow-templates'

import TemplateBody from './components/TemplateBody'

interface TemplateProps {
  template: Template
}

// The template page is a modal and the route is /templates/:templateId
export default function TemplateModal(props: TemplateProps) {
  const { template } = props
  const navigate = useNavigate()
  const goToTemplatesPage = () => navigate(URLS.TEMPLATES)

  const { id, name, description, iconName, steps } = template

  const [createTemplatedFlow, { loading: createFlowLoading }] = useMutation(
    CREATE_TEMPLATED_FLOW,
  )
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
    <>
      <Modal
        isOpen={true}
        onClose={goToTemplatesPage}
        size="5xl"
        motionPreset="none"
        isCentered
        scrollBehavior="inside"
      >
        <ModalOverlay bg="base.canvas.overlay" />
        <ModalContent minH="90vh">
          <ModalHeader>
            <Flex alignItems="center" columnGap={4}>
              <Hide below="md">
                <Box bg="primary.100" p={2} borderRadius={4}>
                  <TemplateIcon iconName={iconName} />
                </Box>
              </Hide>

              <Flex flexDir="column" flexGrow={1} rowGap={0.5}>
                <Text textStyle="subhead-1">{name}</Text>
                <Text textStyle="body-2">{description}</Text>
              </Flex>

              <Button
                size={{ base: 'xs', md: 'md' }}
                isLoading={createFlowLoading}
                onClick={onCreateTemplatedFlow}
              >
                Use template
              </Button>
            </Flex>
          </ModalHeader>
          <ModalBody>
            <TemplateBody templateSteps={steps} />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  )
}

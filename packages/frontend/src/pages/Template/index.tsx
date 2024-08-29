import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client'
import {
  Box,
  Center,
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

import PrimarySpinner from '@/components/PrimarySpinner'
import * as URLS from '@/config/urls'
import type { Template } from '@/graphql/__generated__/graphql'
import { CREATE_TEMPLATED_FLOW } from '@/graphql/mutations/create-templated-flow'
import { GET_TEMPLATE } from '@/graphql/queries/get-template'
import { FALLBACK_ICON, TEMPLATE_ICONS_MAP } from '@/helpers/flow-templates'

import TemplateBody from './components/TemplateBody'
import InvalidTemplatePage from './InvalidTemplatePage'

export default function Template() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const goToTemplatesPage = () => navigate(URLS.TEMPLATES)

  const { data, loading: getTemplateLoading } = useQuery(GET_TEMPLATE, {
    variables: {
      isDemoTemplate: false,
      id: templateId,
    },
  })
  const template: Template = data?.getTemplate

  const [createTemplatedFlow, { loading: createFlowLoading }] = useMutation(
    CREATE_TEMPLATED_FLOW,
  )
  const onCreateTemplatedFlow = useCallback(async () => {
    const response = await createTemplatedFlow({
      variables: {
        input: {
          templateId,
          isDemoTemplate: false,
        },
      },
    })
    navigate(URLS.FLOW(response.data?.createTemplatedFlow?.id))
  }, [createTemplatedFlow, templateId, navigate])

  if (getTemplateLoading) {
    return (
      <Center>
        <PrimarySpinner fontSize="4xl" />
      </Center>
    )
  }

  // Show error page if template cannot be found
  if (!template) {
    return <InvalidTemplatePage />
  }

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
                  {TEMPLATE_ICONS_MAP[template.name] ?? FALLBACK_ICON}
                </Box>
              </Hide>

              <Flex flexDir="column" flexGrow={1} rowGap={0.5}>
                <Text textStyle="subhead-1">{template.name}</Text>
                <Text textStyle="body-2">{template.description}</Text>
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
            <TemplateBody templateSteps={template.steps} />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  )
}

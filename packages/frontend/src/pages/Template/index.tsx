import { IJSONObject } from '@plumber/types'

import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
import { Button, useToast } from '@opengovsg/design-system-react'

import * as URLS from '@/config/urls'
import type { AppEventKeyPair } from '@/graphql/__generated__/graphql'
import { CREATE_TEMPLATED_FLOW } from '@/graphql/mutations/create-templated-flow'
import { FALLBACK_ICON, TEMPLATE_ICONS_MAP } from '@/helpers/flow-templates'

import { TEMPLATES } from '../Templates/templates-data'

import TemplateBody from './components/TemplateBody'
import InvalidTemplatePage from './InvalidTemplatePage'

export default function Template() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const goToTemplatesPage = () => navigate(URLS.TEMPLATES)

  const template = TEMPLATES.find((template) => template.id === templateId)
  const toast = useToast()

  const [createTemplatedFlow, { loading: createFlowLoading }] = useMutation(
    CREATE_TEMPLATED_FLOW,
  )
  const onCreateTemplatedFlow = useCallback(async () => {
    // Simply sanity check: Template steps were not associated with the template
    if (!template || template.steps.length === 0) {
      toast({
        title: `The template is invalid, please contact support@plumber.gov.sg`,
        status: 'error',
        duration: 3000,
        isClosable: true,
        position: 'top',
      })
      return
    }

    const { id, name, steps } = template

    // trigger or action could be null due to if-then
    const trigger: AppEventKeyPair = {
      appKey: steps[0].appKey ?? '',
      eventKey: steps[0].eventKey ?? '',
    }

    const actions: AppEventKeyPair[] = []
    const parametersList: IJSONObject[] = [steps[0].parameters ?? {}]
    for (let i = 1; i < steps.length; i++) {
      actions.push({
        appKey: steps[i].appKey ?? '',
        eventKey: steps[i].eventKey ?? '',
      })
      parametersList.push(steps[i].parameters ?? {})
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
  }, [toast, createTemplatedFlow, template, navigate])

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
                  {TEMPLATE_ICONS_MAP[template.id] ?? FALLBACK_ICON}
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

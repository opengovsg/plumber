import type { IApp } from '@plumber/types'

import { useEffect, useState } from 'react'
import { BiChevronLeft, BiLinkExternal } from 'react-icons/bi'
import { useQuery } from '@apollo/client'
import {
  Button,
  Flex,
  Icon,
  Link,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react'

import * as URLS from '@/config/urls'
import { GET_APPS } from '@/graphql/queries/get-apps'

import ModalBodyContent from './ModalBodyContent'

interface EmptyFlowStepHeaderModalProps {
  isOpen: boolean
  onClose: () => void
  isTrigger: boolean
  isLastStep: boolean
  onSubmit: (appKey: string, eventKey: string) => void
}

export default function EmptyFlowStepHeaderModal(
  props: EmptyFlowStepHeaderModalProps,
): JSX.Element {
  const { isOpen, onClose, isLastStep, isTrigger, onSubmit } = props

  const [selectedApp, setSelectedApp] = useState<IApp | null>(null)

  const { data } = useQuery(GET_APPS)
  const apps: IApp[] = data?.getApps?.filter((app: IApp) =>
    isTrigger ? !!app.triggers?.length : !!app.actions?.length,
  )

  // Reset selected app when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedApp(null)
    }
  }, [isOpen])

  return (
    <Modal
      isCentered
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      scrollBehavior="inside"
      autoFocus={false}
    >
      <ModalOverlay bg="base.canvas.overlay" />
      <ModalContent
        maxW="600px"
        maxH="90vh"
        h="auto"
        overflow="hidden"
        borderRadius="lg"
      >
        <ModalHeader>
          {selectedApp ? (
            <Flex gap={2} flexDir="column" alignItems="flex-start">
              <Button
                variant="clear"
                onClick={() => setSelectedApp(null)}
                leftIcon={<BiChevronLeft />}
                ml={-4}
              >
                Back
              </Button>
              <Text textStyle="h3-semibold">{selectedApp.name}</Text>
              {/* TODO: Check if description is needed for each app */}
            </Flex>
          ) : (
            <Text textStyle="h3-semibold" pt={4}>
              {isTrigger
                ? 'Choose how you want your workflow to start'
                : 'Add steps'}
            </Text>
          )}
        </ModalHeader>

        <ModalBody>
          <ModalBodyContent
            apps={apps}
            selectedApp={selectedApp}
            setSelectedApp={setSelectedApp}
            isTrigger={isTrigger}
            isLastStep={isLastStep}
            onSubmit={onSubmit}
          />
        </ModalBody>

        <ModalFooter justifyContent="center" gap={2}>
          <Text textStyle="caption-1">{`Can't find what you need? Let us know`}</Text>
          <Link
            href={URLS.FEEDBACK_FORM_LINK}
            isExternal
            color="interaction.links.neutral-default"
            mt={1}
          >
            <Icon as={BiLinkExternal} />
          </Link>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

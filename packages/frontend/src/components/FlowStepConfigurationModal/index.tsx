import type { IApp } from '@plumber/types'

import { useEffect, useMemo, useState } from 'react'
import { BiLinkExternal } from 'react-icons/bi'
import { useQuery } from '@apollo/client'
import {
  Icon,
  Link,
  Modal,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  Text,
} from '@chakra-ui/react'

import * as URLS from '@/config/urls'
import { GET_APPS } from '@/graphql/queries/get-apps'

import ChooseApp from './ChooseApp'
import ChooseEvent from './ChooseEvent'

interface FlowStepConfigurationModalProps {
  isOpen: boolean
  onClose: () => void
  isTrigger: boolean
  isLastStep: boolean
  onSubmit: (appKey: string, eventKey: string) => void
}

type ModalScreen = 'choose-app' | 'choose-action'

export default function FlowStepConfigurationModal(
  props: FlowStepConfigurationModalProps,
): JSX.Element {
  const { isOpen, onClose, isLastStep, isTrigger, onSubmit } = props

  const [selectedApp, setSelectedApp] = useState<IApp | null>(null)
  const [currentScreen, setCurrentScreen] = useState<ModalScreen>('choose-app')

  const { data } = useQuery(GET_APPS)
  const apps: IApp[] = data?.getApps?.filter((app: IApp) =>
    isTrigger ? !!app.triggers?.length : !!app.actions?.length,
  )

  // Will consist both modal header and body
  const currentScreenComponent = useMemo(() => {
    switch (currentScreen) {
      case 'choose-app':
        return (
          <ChooseApp
            apps={apps}
            setSelectedApp={setSelectedApp}
            isTrigger={isTrigger}
            onSubmit={onSubmit}
            onNext={() => setCurrentScreen('choose-action')}
          />
        )
      case 'choose-action':
        return (
          selectedApp && (
            <ChooseEvent
              selectedApp={selectedApp}
              isTrigger={isTrigger}
              isLastStep={isLastStep}
              onSubmit={onSubmit}
              onBack={() => {
                setSelectedApp(null)
                setCurrentScreen('choose-app')
              }}
            />
          )
        )
    }
  }, [currentScreen, apps, selectedApp, isTrigger, isLastStep, onSubmit])

  // Reset to the first screen when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedApp(null)
      setCurrentScreen('choose-app')
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
        {currentScreenComponent}

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

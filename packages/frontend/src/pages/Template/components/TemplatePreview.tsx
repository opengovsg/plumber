import { Box, Flex, ModalCloseButton, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import type { IApp, ITemplate } from '@plumber/types'

import BackButton from '@/components/FlowStepConfigurationModal/BackButton'
import { TemplateIcon } from '@/helpers/flow-templates'

import { useCreateTemplatedFlow } from '../hooks/useCreateTemplatedFlow'
import TemplateBody from './TemplateBody'

interface TemplatePreviewProps {
  template: ITemplate
  apps: IApp[]
  /** Shows the Back and close buttons. Omit when the modal has its own route. */
  onBack?: () => void
  /** Closes the modal once the pipe exists, before the editor opens. */
  onDismiss: () => void
}

/**
 * Modal content that previews a template and creates a pipe from it.
 * Render inside a Chakra `ModalContent` with a fixed height.
 */
export default function TemplatePreview(props: TemplatePreviewProps) {
  const { template, apps, onBack, onDismiss } = props
  const { name, description, iconName, steps } = template
  const { createFromTemplate, loading } = useCreateTemplatedFlow(
    template,
    onDismiss,
  )

  return (
    <Flex flexDir="column" flex={1} minH={0} pt={onBack ? 6 : 8} pb={8}>
      {onBack && (
        <>
          <Flex px={8} pb={5} pr={16}>
            <BackButton onBack={onBack} />
          </Flex>
          <ModalCloseButton top="1.5rem" right={7} />
        </>
      )}

      <Box
        flex={1}
        minH={0}
        mx={8}
        mb={8}
        borderWidth={1}
        borderRadius="lg"
        overflowY="auto"
        sx={{
          backgroundImage: 'radial-gradient(#f5f5f5 2px, transparent 2px)',
          backgroundSize: '30px 30px',
        }}
      >
        <Flex flexDir="column" minH="100%">
          <TemplateBody templateSteps={steps} apps={apps} />
          {/* Sticky so the caption stays visible while the steps scroll. */}
          <Flex
            mt="auto"
            position="sticky"
            bottom={0}
            justifyContent="center"
            pt={20}
            pb={6}
            px={4}
            sx={{
              backgroundImage:
                'linear-gradient(to top, #fff 55%, rgba(255, 255, 255, 0))',
            }}
          >
            <Text
              maxW="25rem"
              textAlign="center"
              textStyle="body-2"
              fontSize="0.8125rem"
              color="base.content.medium"
            >
              This is a preview of your workflow. Add details to use this
              template as-is. Or, add more steps to customise it.
            </Text>
          </Flex>
        </Flex>
      </Box>

      <Flex alignItems="center" columnGap={4} px={8}>
        <Box bg="primary.50" color="primary.500" p={2} borderRadius="base">
          <TemplateIcon iconName={iconName} />
        </Box>
        <Flex flexDir="column" flexGrow={1} rowGap={0.5}>
          <Text textStyle="subhead-1">{name}</Text>
          <Text textStyle="body-2" color="base.content.default">
            {description}
          </Text>
        </Flex>
        <Button isLoading={loading} onClick={createFromTemplate}>
          Use template
        </Button>
      </Flex>
    </Flex>
  )
}

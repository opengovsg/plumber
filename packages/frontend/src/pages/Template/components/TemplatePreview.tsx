import { Box, Flex, ModalHeader, Text } from '@chakra-ui/react'
import { Button } from '@opengovsg/design-system-react'
import type { IApp, ITemplate } from '@plumber/types'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useCreateTemplatedFlow } from '../hooks/useCreateTemplatedFlow'
import BackAndCloseRow from './BackAndCloseRow'
import TemplateBody from './TemplateBody'

const SEE_MORE_LABEL = 'see more'

/**
 * Shows one line of the description, then "… see more" directly after the cut.
 * CSS ellipsis cannot place a link beside the ellipsis, so the cut is measured.
 */
function TemplateDescription({
  description,
  isExpanded,
  onExpand,
}: {
  description: string
  isExpanded: boolean
  onExpand: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measurerRef = useRef<HTMLSpanElement>(null)
  // Null while the full description fits on one line.
  const [cutText, setCutText] = useState<string | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    const measurer = measurerRef.current
    if (!container || !measurer || isExpanded) {
      return
    }

    const widthOf = (text: string) => {
      measurer.textContent = text
      return measurer.offsetWidth
    }
    const fit = () => {
      const maxWidth = container.clientWidth
      if (widthOf(description) <= maxWidth) {
        setCutText(null)
        return
      }
      let low = 0
      let high = description.length
      while (low < high) {
        const mid = Math.ceil((low + high) / 2)
        const candidate = `${description.slice(0, mid).trimEnd()}… ${SEE_MORE_LABEL}`
        if (widthOf(candidate) <= maxWidth) {
          low = mid
        } else {
          high = mid - 1
        }
      }
      setCutText(description.slice(0, low).trimEnd())
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(container)
    return () => observer.disconnect()
  }, [description, isExpanded])

  return (
    <Box ref={containerRef} position="relative" minW={0}>
      <Text
        ref={measurerRef}
        as="span"
        aria-hidden
        position="absolute"
        visibility="hidden"
        whiteSpace="nowrap"
        textStyle="body-2"
      />
      <Text textStyle="body-2" color="base.content.default">
        {isExpanded || cutText === null ? description : `${cutText}… `}
        {!isExpanded && cutText !== null && (
          <Text
            as="button"
            type="button"
            display="inline"
            p={0}
            textStyle="body-2"
            color="base.content.medium"
            _hover={{ textDecoration: 'underline' }}
            onClick={onExpand}
          >
            {SEE_MORE_LABEL}
          </Text>
        )}
      </Text>
    </Box>
  )
}

interface TemplatePreviewProps {
  template: ITemplate & { isBuiltIn?: boolean }
  apps: IApp[]
  /** Shows the Back and close buttons. Omit when the modal has its own route. */
  onBack?: () => void
  /** Closes the modal once the pipe exists, before the editor opens. */
  onDismiss?: () => void
  /** Replaces the preview's history entry with the editor. */
  replaceOnCreate?: boolean
  /** Lets the host modal block dismissal while a pipe is being created. */
  onBusyChange?: (isBusy: boolean) => void
}

/**
 * Modal content that previews a template and creates a pipe from it.
 * Render inside a Chakra `ModalContent` with a fixed height.
 */
export default function TemplatePreview(props: TemplatePreviewProps) {
  const { template, apps, onBack, onDismiss, replaceOnCreate, onBusyChange } =
    props
  const { name, description, steps } = template
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const { createFromTemplate, loading } = useCreateTemplatedFlow(
    template,
    onDismiss,
    replaceOnCreate,
  )

  useEffect(() => {
    onBusyChange?.(loading)
  }, [loading, onBusyChange])

  return (
    <Flex flexDir="column" flex={1} minH={0} pt={onBack ? 6 : 8} pb={8}>
      {onBack && (
        <Box pb={5}>
          {/* A second creation from another preview would race this one. */}
          <BackAndCloseRow onBack={onBack} isDisabled={loading} />
        </Box>
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
          {/* Sticky so the caption stays visible while the steps scroll.
              Short viewports scroll it with the steps so it cannot cover links. */}
          <Flex
            mt="auto"
            bottom={0}
            justifyContent="center"
            pt={20}
            pb={6}
            px={4}
            sx={{
              backgroundImage:
                'linear-gradient(to top, #fff 55%, rgba(255, 255, 255, 0))',
              '@media (min-height: 44rem)': { position: 'sticky' },
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

      <Flex
        alignItems={isDescriptionExpanded ? 'flex-start' : 'center'}
        columnGap={3}
        px={8}
      >
        <Flex flexDir="column" flexGrow={1} minW={0} rowGap={0.5}>
          <ModalHeader
            p={0}
            textStyle="subhead-1"
            fontWeight={600}
            fontSize="1rem"
          >
            {name}
          </ModalHeader>
          <TemplateDescription
            isExpanded={isDescriptionExpanded}
            onExpand={() => setIsDescriptionExpanded(true)}
            description={description}
          />
        </Flex>
        <Button
          flexShrink={0}
          ml={3}
          isLoading={loading}
          onClick={createFromTemplate}
        >
          Use template
        </Button>
      </Flex>
    </Flex>
  )
}

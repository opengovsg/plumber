import { Box, Divider, Flex, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'
import type { IApp, ITemplateStep } from '@plumber/types'
import { Fragment } from 'react'

import { TOOLBOX_ACTIONS, TOOLBOX_APP_KEY } from '@/helpers/toolbox'
import {
  getIfBlockPreviewTitle,
  getRepeatBlockPreviewTitle,
} from '@/pages/AiBuilder/components/StepsPreview/helpers/previewBlockTitle'
import type { PreviewStep } from '@/pages/AiBuilder/components/StepsPreview/helpers/previewItems'

import type { TemplatePreviewItem } from '../helpers/template-topology'
import TemplateConditionBlock from './TemplateConditionBlock'
import TemplateStepContent from './TemplateStepContent'

interface TemplatePreviewListProps {
  items: TemplatePreviewItem[]
  apps: IApp[]
  isNested?: boolean
}

function toPreviewStep(step: ITemplateStep): PreviewStep {
  return {
    position: step.position,
    appKey: step.appKey,
    key: step.eventKey,
    parameters: step.parameters ?? {},
  } as PreviewStep
}

function isOnlyContinueIf(step: ITemplateStep): boolean {
  return (
    step.appKey === TOOLBOX_APP_KEY &&
    step.eventKey === TOOLBOX_ACTIONS.OnlyContinueIf
  )
}

export default function TemplatePreviewList({
  items,
  apps,
  isNested = false,
}: TemplatePreviewListProps) {
  const renderItem = (item: TemplatePreviewItem) => {
    const { step, children } = item
    if (item.type === 'step') {
      if (isOnlyContinueIf(step)) {
        return (
          <TemplateConditionBlock
            label={`Continue if block ${step.position}`}
            badge="CONTINUE IF"
            title={getIfBlockPreviewTitle(toPreviewStep(step))}
            isNested={isNested}
          />
        )
      }
      return (
        <TemplateStepContent
          app={apps.find((app) => app.key === step.appKey)}
          templateStep={step}
          isNested={isNested}
        />
      )
    }

    const isIfThen = item.type === 'ifThenBlock'
    return (
      <TemplateConditionBlock
        label={`${isIfThen ? 'If' : 'Repeat'} block ${step.position}`}
        badge={isIfThen ? 'IF' : 'REPEAT'}
        title={
          isIfThen
            ? getIfBlockPreviewTitle(toPreviewStep(step))
            : getRepeatBlockPreviewTitle(toPreviewStep(step))
        }
        isNested={isNested}
      >
        {item.isDangling && (
          <Infobox variant="warning" mb={4}>
            This block has an invalid boundary. Its preview uses the legacy
            grouping rules.
          </Infobox>
        )}
        {children.length > 0 ? (
          <TemplatePreviewList items={children} apps={apps} isNested />
        ) : (
          <Text textStyle="body-2" color="base.content.medium">
            No steps in this block
          </Text>
        )}
      </TemplateConditionBlock>
    )
  }

  return (
    <Flex flexDir="column" alignItems="center" w="100%">
      {items.map((item, index) => (
        <Fragment key={item.step.position}>
          {renderItem(item)}
          {item.rejectionChildren.length > 0 && (
            <Flex
              role="group"
              aria-label={`Rejection branch ${item.step.position}`}
              w={isNested ? '100%' : '600px'}
              maxW="100%"
              flexDir="column"
              borderLeft="2px solid"
              borderColor="base.divider.medium"
              pl={4}
              mt={4}
              gap={4}
            >
              <Text textStyle="subhead-1">If rejected</Text>
              <TemplatePreviewList
                items={item.rejectionChildren}
                apps={apps}
                isNested
              />
            </Flex>
          )}
          {index < items.length - 1 && (
            <Box h={12}>
              <Divider
                orientation="vertical"
                borderColor="base.divider.strong"
              />
            </Box>
          )}
        </Fragment>
      ))}
    </Flex>
  )
}

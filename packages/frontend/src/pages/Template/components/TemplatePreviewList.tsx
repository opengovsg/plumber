import type { IApp } from '@plumber/types'

import { Fragment } from 'react'
import { Box, Divider, Flex, Text } from '@chakra-ui/react'
import { Infobox } from '@opengovsg/design-system-react'

import type { TemplatePreviewItem } from '../helpers/template-topology'

import TemplateStepContent from './TemplateStepContent'

interface TemplatePreviewListProps {
  items: TemplatePreviewItem[]
  apps: IApp[]
  isNested?: boolean
}

export default function TemplatePreviewList({
  items,
  apps,
  isNested = false,
}: TemplatePreviewListProps) {
  return (
    <Flex flexDir="column" alignItems="center" w="100%">
      {items.map((item, index) => {
        const { step, children, rejectionChildren } = item
        const isBlock = item.type !== 'step'
        const blockName = item.type === 'ifThenBlock' ? 'If' : 'Repeat'
        const card = (
          <TemplateStepContent
            app={apps.find((app) => app.key === step.appKey)}
            templateStep={step}
            isNested={isNested}
          />
        )
        return (
          <Fragment key={step.position}>
            {isBlock ? (
              <Flex
                role="group"
                aria-label={`${blockName} block ${step.position}`}
                flexDir="column"
                w="100%"
                border="1px solid"
                borderColor="base.divider.medium"
                borderRadius="lg"
                p={4}
                gap={4}
              >
                <Text textStyle="subhead-1">{blockName}</Text>
                {card}
                {item.isDangling && (
                  <Infobox variant="warning">
                    This block has an invalid boundary. Its preview uses the
                    legacy grouping rules.
                  </Infobox>
                )}
                <Flex
                  flexDir="column"
                  bg="base.canvas.default"
                  borderRadius="lg"
                  p={4}
                  gap={4}
                >
                  <Text textStyle="caption-2">
                    {item.type === 'ifThenBlock'
                      ? 'When conditions are met'
                      : 'For each item'}
                  </Text>
                  {children.length > 0 ? (
                    <TemplatePreviewList
                      items={children}
                      apps={apps}
                      isNested
                    />
                  ) : (
                    <Text textStyle="body-2">No steps in this block</Text>
                  )}
                </Flex>
              </Flex>
            ) : (
              card
            )}
            {rejectionChildren.length > 0 && (
              <Flex
                role="group"
                aria-label={`Rejection branch ${step.position}`}
                w="100%"
                flexDir="column"
                borderLeft="2px solid"
                borderColor="base.divider.medium"
                pl={4}
                mt={4}
                gap={4}
              >
                <Text textStyle="subhead-1">If rejected</Text>
                <TemplatePreviewList
                  items={rejectionChildren}
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
        )
      })}
    </Flex>
  )
}

import { IApp, IStep } from '@plumber/types'

import {
  BiArrowFromRight,
  BiSolidCheckCircle,
  BiSolidErrorCircle,
} from 'react-icons/bi'
import { Flex, Icon, Image } from '@chakra-ui/react'

import { getToolboxIcon } from '@/helpers/editor'
import { TOOLBOX_APP_KEY } from '@/helpers/toolbox'

import { flowStepStyles } from '../styles'

interface AppIconProps {
  app?: IApp
  isCompleted?: boolean
  isNested?: boolean
  isTestSuccessful?: boolean
  shouldTestStepAgain?: boolean
  step?: IStep
}

export default function StepAppIcon(props: AppIconProps) {
  const {
    app,
    isCompleted,
    isNested,
    isTestSuccessful,
    shouldTestStepAgain,
    step,
  } = props

  const showBadge =
    isCompleted || shouldTestStepAgain || isTestSuccessful === false

  const boxSize = isNested ? 6 : 8
  const FallbackIcon = (
    <Icon
      boxSize={boxSize}
      as={BiArrowFromRight}
      color="base.content.default"
    />
  )

  return (
    <Flex {...flowStepStyles.appIconWrapper} boxSize={boxSize} flexShrink={0}>
      {/* App icon */}
      {app ? (
        app?.key === TOOLBOX_APP_KEY ? (
          <Icon
            boxSize={boxSize}
            as={getToolboxIcon(step?.key)}
            color="primary.500"
          />
        ) : (
          <Image
            src={app?.iconUrl}
            boxSize={boxSize}
            fit="contain"
            fallback={FallbackIcon}
          />
        )
      ) : (
        FallbackIcon
      )}
      {/*
       * Step completion status badge
       */}
      {showBadge && (
        <Flex
          position="absolute"
          top={0}
          insetEnd={0}
          boxSize={4}
          transform="translate(0.5rem, -0.5rem)"
          borderRadius="full"
          bg="white"
        >
          {shouldTestStepAgain ? (
            <Icon boxSize="full" color="yellow.200" as={BiSolidErrorCircle} />
          ) : isTestSuccessful === false ? (
            <Icon
              boxSize="full"
              color="interaction.critical.default"
              as={BiSolidErrorCircle}
            />
          ) : (
            isCompleted &&
            isTestSuccessful && (
              <Icon
                boxSize="full"
                color="interaction.success.default"
                as={BiSolidCheckCircle}
              />
            )
          )}
        </Flex>
      )}
    </Flex>
  )
}

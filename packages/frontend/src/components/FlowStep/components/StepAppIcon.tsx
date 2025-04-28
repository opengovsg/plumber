import { IApp } from '@plumber/types'

import {
  BiArrowFromRight,
  BiSolidCheckCircle,
  BiSolidErrorCircle,
} from 'react-icons/bi'
import { Flex, Icon, Image } from '@chakra-ui/react'

import { flowStepStyles } from '../styles'

interface AppIconProps {
  app?: IApp
  isCompleted?: boolean
  isNested?: boolean
  isTestSuccessful?: boolean
  shouldTestStepAgain?: boolean
}

export default function StepAppIcon(props: AppIconProps) {
  const { app, isCompleted, isNested, isTestSuccessful, shouldTestStepAgain } =
    props

  const showBadge = isCompleted || shouldTestStepAgain || !isTestSuccessful

  return (
    <Flex {...flowStepStyles.appIconWrapper} boxSize={isNested ? 6 : 8}>
      {/* App icon */}
      <Image
        src={app?.iconUrl}
        boxSize={isNested ? 6 : 8}
        fit="contain"
        fallback={
          <Icon
            boxSize={6}
            as={BiArrowFromRight}
            color="base.content.default"
          />
        }
      />
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
          ) : !isTestSuccessful ? (
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

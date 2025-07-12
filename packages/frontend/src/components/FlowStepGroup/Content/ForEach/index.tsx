import { IStep } from '@plumber/types'

import { Fragment, useContext, useMemo } from 'react'
import { Flex } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
import { FlowStep, FlowStepGroup } from '@/exports/components'

import { HoverAddStepButton } from '../IfThen/HoverAddStepButton'
import { allowAddStep } from '../utils'

interface ForEachProps {
  groupedSteps: IStep[][]
  stepsBeforeGroup: IStep[]
}

export default function ForEach(props: ForEachProps) {
  const { groupedSteps } = props

  const { isDrawerOpen, readOnly: isEditorReadOnly } = useContext(EditorContext)
  const forEachSteps = groupedSteps[0]
  const ifThenSteps = useMemo(() => {
    if (groupedSteps.length === 1) {
      return []
    }
    return groupedSteps.slice(1)
  }, [groupedSteps])

  const canAddStep =
    allowAddStep(forEachSteps) ||
    (forEachSteps.length === 1 && ifThenSteps.length !== 0)

  return (
    <Flex flexDir="column" alignItems="center" borderRadius="lg" w="100%">
      <Flex flexDir="column" w="100%" px={4} py={3}>
        {forEachSteps?.map((step, index) => {
          return (
            <Fragment key={step.id}>
              <FlowStep
                step={step}
                index={index}
                isDeletable={index !== 0}
                isNested={true}
                isLastStep={index === forEachSteps.length - 1}
              />
              <HoverAddStepButton
                isDisabled={isEditorReadOnly || !canAddStep}
                isDrawerOpen={isDrawerOpen}
                isLastStep={
                  index === forEachSteps.length - 1 && ifThenSteps.length === 0
                }
                prevStepId={step.id}
              />
            </Fragment>
          )
        })}
        {ifThenSteps.length > 0 && (
          <FlowStepGroup
            stepsBeforeGroup={forEachSteps}
            groupedSteps={ifThenSteps}
          />
        )}
      </Flex>
    </Flex>
  )
}

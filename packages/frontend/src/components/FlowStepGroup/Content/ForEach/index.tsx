import { IStep } from '@plumber/types'

import { Fragment, useContext, useMemo } from 'react'
import { Flex } from '@chakra-ui/react'

import { EditorContext } from '@/contexts/Editor'
import { FlowStep, FlowStepGroup } from '@/exports/components'
import { TOOLBOX_ACTIONS } from '@/helpers/toolbox'

import { HoverAddStepButton } from '../IfThen/HoverAddStepButton'

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

  // NOTE: groupedSteps includes for-each and if-then actions
  // so groupedSteps === 1 means that there is only the for-each action
  const nonForEachActionSteps = forEachSteps.filter(
    (step) => step.type === 'action' && step.key !== TOOLBOX_ACTIONS.ForEach,
  )
  const hasNoActionSteps =
    nonForEachActionSteps.length === 0 && groupedSteps.length === 1

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
                isDisabled={isEditorReadOnly || hasNoActionSteps}
                isDrawerOpen={isDrawerOpen}
                isLastStep={
                  index === forEachSteps.length - 1 && ifThenSteps.length === 0
                }
                prevStepId={step.id}
                // show empty action if no action step exists
                showEmptyAction={hasNoActionSteps}
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

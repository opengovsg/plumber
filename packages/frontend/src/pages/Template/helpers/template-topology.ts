import type { IStep, ITemplateStep } from '@plumber/types'

import {
  buildStepsList,
  type StepsListItem,
} from '@/components/Editor/helpers/steps-utils'

export interface TemplatePreviewItem {
  type: 'step' | 'ifThenBlock' | 'forEachBlock'
  step: ITemplateStep
  children: TemplatePreviewItem[]
  rejectionChildren: TemplatePreviewItem[]
  isDangling: boolean
}

const GROUPING_ACTIONS = new Set(['toolbox-forEach'])

export function buildTemplatePreview(
  templateSteps: ITemplateStep[],
): TemplatePreviewItem[] {
  const ordered = [...templateSteps].sort((a, b) => a.position - b.position)
  const byId = new Map(
    ordered.map((step) => [`<<step_id_${step.position}>>`, step]),
  )
  // The editor's read model only inspects identity, parameters, and config.
  const steps = ordered.map(
    (step) =>
      ({
        id: `<<step_id_${step.position}>>`,
        position: step.position,
        appKey: step.appKey,
        key: step.eventKey,
        parameters: step.parameters ?? {},
        config: step.config ?? {},
      } as IStep),
  )
  const rejectionSteps = new Map<string, IStep[]>()
  for (const step of steps) {
    const ownerId = step.config.approval?.stepId
    if (ownerId) {
      const branch = rejectionSteps.get(ownerId) ?? []
      branch.push(step)
      rejectionSteps.set(ownerId, branch)
    }
  }

  const translate = (items: StepsListItem[]): TemplatePreviewItem[] =>
    items.map((item) => {
      const step =
        item.type === 'ifThenBlock'
          ? item.ifThenStep
          : item.type === 'forEachBlock'
          ? item.forEachStep
          : item.step
      const children =
        item.type === 'ifThenBlock'
          ? translate(buildStepsList(item.children, GROUPING_ACTIONS))
          : item.type === 'forEachBlock'
          ? translate(item.children)
          : []
      const branch = rejectionSteps.get(step.id) ?? []
      return {
        type: item.type,
        step: byId.get(step.id)!,
        children,
        rejectionChildren:
          step.appKey === 'formsg' && step.key === 'mrfSubmission'
            ? translate(buildStepsList(branch, GROUPING_ACTIONS))
            : [],
        isDangling: item.type === 'ifThenBlock' && item.isDangling,
      }
    })

  return translate(
    buildStepsList(
      steps.filter((step) => !step.config.approval),
      GROUPING_ACTIONS,
    ),
  )
}

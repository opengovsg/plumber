import type { PipeId } from '@plumber/shared'

export interface PipeChoice {
  pipeId: PipeId
  name: string
  published: boolean
}

export type PipeChip =
  | { kind: 'pick'; onSelect: (choice: PipeChoice) => void }
  | { kind: 'hidden' }

export function derivePipeChip({
  pipeCreated,
  selectedName,
  recoveredName,
  onSelect,
}: {
  pipeCreated: boolean
  selectedName: string | null
  recoveredName: string | null
  onSelect: (choice: PipeChoice) => void
}): PipeChip {
  // The header shows the selected pipe's title, so the composer does not repeat it.
  if ((selectedName ?? recoveredName)?.trim()) {
    return { kind: 'hidden' }
  }
  // A model-created pipe has no selection sentence, so the chip stays hidden.
  if (pipeCreated) {
    return { kind: 'hidden' }
  }
  return { kind: 'pick', onSelect }
}

export function pipeHeaderTitle({
  flowName,
  selectedName,
  recoveredName,
}: {
  flowName: string
  selectedName: string | null
  recoveredName: string | null
}): string {
  const pipeTitle = (selectedName ?? recoveredName)?.trim()
  return pipeTitle || flowName
}

export function showConnectFormChip({
  pipeCreated,
  selectedName,
  recoveredName,
}: {
  pipeCreated: boolean
  selectedName: string | null
  recoveredName: string | null
}): boolean {
  if (pipeCreated) {
    return false
  }
  return !(selectedName ?? recoveredName)?.trim()
}

export function showComposerChips({
  formCallbacks,
  attachedForm,
  pipeChip,
}: {
  formCallbacks: boolean
  attachedForm: boolean
  pipeChip: PipeChip
}): boolean {
  return formCallbacks || attachedForm || pipeChip.kind !== 'hidden'
}

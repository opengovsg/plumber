import type { PipeId } from '@plumber/shared'

export interface PipeChoice {
  pipeId: PipeId
  name: string
  published: boolean
}

export type PipeChip =
  | { kind: 'pick'; onSelect: (choice: PipeChoice) => void }
  | { kind: 'named'; name: string }
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
  const name = selectedName ?? recoveredName
  if (name) {
    return { kind: 'named', name }
  }
  // A model-created pipe has no selection sentence, so the chip stays hidden.
  if (pipeCreated) {
    return { kind: 'hidden' }
  }
  return { kind: 'pick', onSelect }
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

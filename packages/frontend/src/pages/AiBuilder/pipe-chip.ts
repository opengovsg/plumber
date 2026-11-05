import type { PipeId } from '@plumber/shared'

export interface PipeChoice {
  pipeId: PipeId
  name: string
  published: boolean
}

export type PipeChip =
  | { kind: 'pick'; onSelect: (choice: PipeChoice) => void }
  | { kind: 'hidden' }

// The server confirms a selection by sending that pipe's state. A refused or
// published pick never does, so the picker must come back.
export function resolveSubjectName({
  subject,
  previewPipeId,
  selectionPending,
}: {
  subject: { pipeId: PipeId; displayName: string } | null
  previewPipeId: string | null
  selectionPending: boolean
}): string | null {
  if (!subject) {
    return null
  }
  if (selectionPending || previewPipeId === subject.pipeId) {
    return subject.displayName.trim() || null
  }
  return null
}

export function derivePipeChip({
  pipeCreated,
  subjectName,
  onSelect,
}: {
  pipeCreated: boolean
  subjectName: string | null
  onSelect: (choice: PipeChoice) => void
}): PipeChip {
  // The header shows the selected pipe's title, so the composer does not repeat it.
  if (subjectName) {
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
  subjectName,
}: {
  flowName: string
  subjectName: string | null
}): string {
  return subjectName || flowName
}

export function showConnectFormChip({
  pipeCreated,
  subjectName,
}: {
  pipeCreated: boolean
  subjectName: string | null
}): boolean {
  return !pipeCreated && !subjectName
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

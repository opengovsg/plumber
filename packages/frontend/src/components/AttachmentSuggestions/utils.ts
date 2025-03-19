import { TDataOutMetadatumType } from '@plumber/types'

import { FieldValues } from 'react-hook-form'

import { type CheckboxVariable } from './components/Checkbox'

export const MAX_NUM_FILES = 10
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB in bytes
const MAX_TOTAL_FILE_SIZE = 5 * MAX_FILE_SIZE // 10MB in bytes

export const ACCEPTED_FILE_TYPES = [
  'text/plain', // .txt, .asc
  'video/x-msvideo', // .avi
  'image/bmp', // .bmp
  'text/csv', // .csv
  'application/x-dgn', // .dgn
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/x-dwf', // .dwf
  'application/x-dwg', // .dwg
  'application/x-dxf', // .dxf
  'application/x-ent', // .ent
  'image/gif', // .gif
  'image/jpeg', // .jpg, .jpeg
  'video/mpeg', // .mpeg, .mpg
  'application/vnd.ms-project', // .mpp
  'application/vnd.oasis.opendocument.database', // .odb
  'application/vnd.oasis.opendocument.formula', // .odf
  'application/vnd.oasis.opendocument.graphics', // .odg
  'application/vnd.oasis.opendocument.spreadsheet', // .ods
  'application/pdf', // .pdf
  'image/png', // .png
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/rtf', // .rtf
  'application/vnd.sun.xml.calc', // .sxc
  'application/vnd.sun.xml.draw', // .sxd
  'application/vnd.sun.xml.impress', // .sxi
  'application/vnd.sun.xml.writer', // .sxw
  'image/tiff', // .tif, .tiff
  'video/x-ms-wmv', // .wmv
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
]

export interface AttachmentConfigInput {
  name: string
  displayedValue: string
  value: string
  size?: number
  updatedAt?: string | number
}

type FileSizeValidationResult = {
  isValid: boolean
  error?: string
}

export function formatFileSizeToStr(sizeInBytes: number): string {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B` // Bytes
  } else if (sizeInBytes < 1024 * 1024) {
    const sizeInKB = (sizeInBytes / 1024).toFixed(2) // Kilobytes with 2 decimal places
    return `${sizeInKB} KB`
  } else {
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2) // Megabytes with 2 decimal places
    return `${sizeInMB} MB`
  }
}

function sortAttachmentsByUpdatedAt(options: CheckboxVariable[]) {
  return [...options].sort((a, b) => {
    if (!a.updatedAt || !b.updatedAt) {
      return 0
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

export function createUpdateFlowConfigInput(
  flowId: string,
  attachments: string[],
) {
  return {
    variables: {
      input: {
        id: flowId,
        attachments,
      },
    },
  }
}

export function createUpdateStep(
  formValues: FieldValues,
  updatedAttachments: string[],
) {
  const { appKey, id, key, parameters, connection, flow } = formValues
  const mutationInput: Record<string, unknown> = {
    id,
    key,
    parameters: {
      ...parameters,
      attachments: updatedAttachments,
    },
    connection: {
      id: connection?.id,
    },
    flow: {
      id: flow.id,
    },
  }

  if (appKey) {
    mutationInput.appKey = appKey
  }
  return mutationInput
}

export function reformatToCheckboxVariables(
  options: CheckboxVariable[],
): CheckboxVariable[] {
  if (options.length === 0) {
    return []
  }

  return sortAttachmentsByUpdatedAt(options).map((a, index) => {
    const { name, displayedValue, value, size, updatedAt } = a
    return {
      /**
       * NOTE: we store the value as name because variables are stored
       * using the name field as {{step.xyx}}.
       * We use name for consistent setting of the selected checkbox.
       */
      name,
      value,
      displayedValue,
      type: 'file' as TDataOutMetadatumType,
      order: index + 1,
      label: name,
      size,
      updatedAt,
      uploaded: true,
    }
  })
}

export function reformatToAttachmentConfig(
  options: CheckboxVariable[],
): AttachmentConfigInput[] {
  if (options.length === 0) {
    return []
  }

  return sortAttachmentsByUpdatedAt(options).map((o) => {
    const { displayedValue, name, value, size, updatedAt } = o
    return {
      name,
      displayedValue,
      value: value as string,
      size,
      updatedAt,
    } as AttachmentConfigInput
  })
}

export function validateFiles(
  file: File | CheckboxVariable,
  selectedOptions: (AttachmentConfigInput | CheckboxVariable)[],
): FileSizeValidationResult {
  const fileSize = file.size ?? 0
  const currentTotalSize = selectedOptions.reduce(
    (acc, curr) => acc + (curr?.size ?? 0),
    0,
  )
  const totalSize = currentTotalSize + fileSize
  const currentFileCount = selectedOptions.length + 1

  if (currentFileCount >= MAX_NUM_FILES) {
    return {
      isValid: false,
      error: 'Total number of files exceeds 10',
    }
  }
  if (fileSize > MAX_FILE_SIZE) {
    return { isValid: false, error: 'Size of attachment exceeds 2MB' }
  }
  if (totalSize > MAX_TOTAL_FILE_SIZE) {
    return {
      isValid: false,
      error: 'Total size of attachments exceeds 10MB',
    }
  }
  return { isValid: true }
}

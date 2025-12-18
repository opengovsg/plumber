import { TDataOutMetadatumType } from '@plumber/types'

import { FieldValues } from 'react-hook-form'
import set from 'lodash/set'

import { type CheckboxVariable } from './components/Checkbox'

const KB = 1024
const MB = KB * KB
export const DEFAULT_MAX_NUM_FILES = 10
const MAX_FILE_SIZE = 10 * MB // 10MB
const MAX_TOTAL_FILE_SIZE = 10 * MB // 10MB

export const DEFAULT_FILE_TYPES = [
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
  if (sizeInBytes < KB) {
    return `${sizeInBytes} B` // Bytes
  } else if (sizeInBytes < MB) {
    const sizeInKB = (sizeInBytes / KB).toFixed(2) // Kilobytes with 2 decimal places
    return `${sizeInKB} KB`
  } else {
    const sizeInMB = (sizeInBytes / MB).toFixed(2) // Megabytes with 2 decimal places
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
  parameterName: string,
  formValues: FieldValues,
  updatedAttachments: string[],
) {
  const { appKey, id, key, parameters, connection, flow } = formValues
  const mutationInput: Record<string, unknown> = {
    id,
    key,
    parameters: {
      ...parameters,
    },
    connection: {
      id: connection?.id,
    },
    flow: {
      id: flow.id,
    },
  }

  // we use lodash.set as the parameterName is in this format: parameters.attachments / parameters.image
  set(mutationInput, parameterName, updatedAttachments)

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
      isCollapsedByDefault: false,
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
  options: CheckboxVariable[],
  currentSelection: string[],
  maxNumFiles: number,
): FileSizeValidationResult {
  const fileSize = file.size ?? 0
  const selectedOptions = options.filter((o) =>
    currentSelection.includes(o.name),
  )
  const currentTotalSize = selectedOptions.reduce(
    (acc, curr) => acc + (curr?.size ?? 0),
    0,
  )
  const totalSize = currentTotalSize + fileSize
  const currentFileCount = selectedOptions.length + 1

  const maxAllowedFiles = maxNumFiles ?? DEFAULT_MAX_NUM_FILES
  if (currentFileCount > maxAllowedFiles) {
    return {
      isValid: false,
      error: `Maximum of ${maxAllowedFiles} file${
        maxAllowedFiles === 1 ? '' : 's'
      } allowed`,
    }
  }

  const { isValid: isValidFileSize, error: fileSizeError } =
    validateFileSize(file)
  if (!isValidFileSize) {
    return { isValid: false, error: fileSizeError }
  }
  if (totalSize > MAX_TOTAL_FILE_SIZE) {
    return {
      isValid: false,
      error: 'Total size of attachments exceeds 10MB',
    }
  }
  return { isValid: true }
}

export function validateFileSize(
  file: File | CheckboxVariable,
): FileSizeValidationResult {
  const fileSize = file.size ?? 0
  if (fileSize > MAX_FILE_SIZE) {
    return { isValid: false, error: 'Size of attachment exceeds 10MB' }
  }
  return { isValid: true }
}

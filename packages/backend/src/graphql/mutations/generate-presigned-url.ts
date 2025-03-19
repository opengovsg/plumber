import { randomUUID } from 'crypto'

import {
  COMMON_S3_BUCKET,
  getPresignedUrl,
  validateObjectKey,
} from '@/helpers/s3'
import Flow from '@/models/flow'

import { MutationResolvers } from '../__generated__/types.generated'

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
const MAX_FILE_SIZE = 1024 * 1024 * 2 // 2 MB

const generatePresignedUrl: MutationResolvers['generatePresignedUrl'] = async (
  _parent,
  params,
  context,
) => {
  const { flowId, filename, fileType, size, updatedAt, manualUpload } =
    params.input

  if (size > MAX_FILE_SIZE) {
    throw new Error('Size of attachment exceeds 2MB')
  }
  if (!ACCEPTED_FILE_TYPES.includes(fileType)) {
    throw new Error('Unsupported file type')
  }

  const uuid = randomUUID()
  const filePath = `${flowId}/${uuid}/${filename}`
  if (!validateObjectKey(filePath)) {
    throw new Error('File path cannot be longer than 1024 bytes')
  }

  await Flow.hasAccess(context.currentUser.id, flowId)

  const url = await getPresignedUrl(COMMON_S3_BUCKET, filePath, fileType, {
    flowId,
    filename,
    size: size.toString(),
    updatedAt,
    manualUpload: manualUpload.toString(),
  })

  return { url, s3Id: `s3:${COMMON_S3_BUCKET}:${filePath}` }
}

export default generatePresignedUrl

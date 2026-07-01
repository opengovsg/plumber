export const POSTMAN_ACCEPTED_EXTENSIONS = [
  'txt',
  'asc',
  'avi',
  'bmp',
  'csv',
  'dgn',
  'docx',
  'dwf',
  'dwg',
  'dxf',
  'ent',
  'gif',
  'jpg',
  'jpeg',
  'mpeg',
  'mpg',
  'mpp',
  'odb',
  'odf',
  'odg',
  'ods',
  'pdf',
  'png',
  'pptx',
  'rtf',
  'sxc',
  'sxd',
  'sxi',
  'sxw',
  'tif',
  'tiff',
  'wmv',
  'xlsx',
]

/**
 * The block-list of executable/script extensions SES refuses now lives in the
 * shared S3 helper because it also gates uploads (generatePresignedPost), not
 * just SES sends; re-exported here so the send-time filter keeps its import.
 */
export { SES_BLOCKED_EXTENSIONS } from '@/helpers/s3'

export const POSTMAN_SUPPORTED_ATTACHMENTS_GUIDE_URL =
  'https://postman-v1.guides.gov.sg/email-api-guide/programmatic-email-api/send-email-api/attachments#list-of-supported-attachment-file-types'

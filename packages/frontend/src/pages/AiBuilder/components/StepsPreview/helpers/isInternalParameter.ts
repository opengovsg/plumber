import { FORMSG_APP_KEY } from '@/helpers/formsg'

/**
 * The editor builds its rows from a step's declared fields, so it never shows
 * the MRF stage data that Plumber keeps on a FormSG step. The preview builds
 * rows from the raw parameters, so it has to skip that data itself.
 */
export function isInternalParameter(appKey: string, key: string): boolean {
  return appKey === FORMSG_APP_KEY && key === 'mrf'
}

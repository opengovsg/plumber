import apps from '@/apps'

export function getStepVersion(appKey?: string, key?: string): number {
  if (!appKey || !key) {
    return 1
  }
  return apps[appKey]?.stepTransformer?.getLatestStepVersion(key) ?? 1
}

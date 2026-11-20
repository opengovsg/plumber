/**
 * Rows whose gold encodes a consent or safety rule.
 * A flip to fail on these is a regression whatever the overall pass rate does.
 */
export function isSafetyRow(metadata, covers = []) {
  const meta = metadata && typeof metadata === 'object' ? metadata : {}
  const tags = Array.isArray(covers) ? covers : []
  return (
    meta.suite === 'safety' ||
    meta.tier === 'safety' ||
    tags.includes('failure:side_effect_without_consent')
  )
}

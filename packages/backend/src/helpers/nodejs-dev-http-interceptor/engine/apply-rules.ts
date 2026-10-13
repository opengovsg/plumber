import type {
  ApplicableRequestParams,
  DevRequest,
  DevRequestRule,
} from '../types'

export function hasApplicableRule(
  rules: readonly DevRequestRule[],
  request: ApplicableRequestParams,
): boolean {
  return rules.some((rule) => rule.isApplicableRequest(request))
}

export function applyRules(
  rules: readonly DevRequestRule[],
  request: DevRequest,
): void {
  for (const rule of rules) {
    // Checked per rule so an earlier rule can change what a later rule matches on.
    if (rule.isApplicableRequest(request)) {
      rule.rewrite(request)
    }
  }
}

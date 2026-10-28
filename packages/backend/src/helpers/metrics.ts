import tracer from './tracer'

export function incrementMetric(
  name: string,
  tags: Record<string, string> = {},
  value = 1,
): void {
  tracer.dogstatsd.increment(name, value, {
    ...tags,
  })
}

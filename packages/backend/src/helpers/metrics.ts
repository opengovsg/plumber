import tracer from './tracer'

export function incrementMetric(
  name: string,
  tags: Record<string, string> = {},
): void {
  tracer.dogstatsd.increment(name, 1, {
    ...tags,
  })
}

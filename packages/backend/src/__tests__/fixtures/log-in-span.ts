// Loads the given modules in argv order, then logs inside a dd-trace span.
async function main(): Promise<void> {
  for (const specifier of process.argv.slice(2)) {
    await import(specifier)
  }
  const { default: tracer } = await import('dd-trace')
  const { default: logger } = await import('@/helpers/logger')
  tracer.trace('entry-load-order', () => logger.info('log-in-span'))
  process.exit(0)
}

void main()

import appConfig from '@/config/app'

// IMPORTANT: Import this before any other module sends HTTP requests.
if (appConfig.isDev) {
  // Lazy require keeps dev-only code and devDependencies out of production.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./engine').install()
}

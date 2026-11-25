import { getEnvironmentConfig } from '../environments'

getEnvironmentConfig()

// JSON secret masking does not cover individual IDs in Playwright errors.
if (process.env.GITHUB_ACTIONS === 'true') {
  const ids = process.env.E2E_FIXTURE_MANIFEST!.match(
    /[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}|[a-f0-9]{24}/gi,
  )
  for (const id of new Set(ids)) {
    console.log(`::add-mask::${id}`)
  }
}

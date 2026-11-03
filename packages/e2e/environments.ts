import { z } from 'zod'

const fixtureProfileSchema = z.object({
  pipes: z.object({
    delayFor: z.string().uuid(),
    delayUntil: z.string().uuid(),
    toolbox: z.string().uuid(),
    postman: z.string().uuid(),
    tiles: z.string().uuid(),
    m365: z.string().uuid(),
    slack: z.string().uuid(),
    telegram: z.string().uuid(),
    gathersgCreate: z.string().uuid(),
    gathersgUpdate: z.string().uuid(),
    editor: z.string().uuid(),
    gathersgTrigger: z.string().uuid(),
    gathersgEmailTrigger: z.string().uuid(),
  }),
  forms: z.object({
    trigger: z.string().regex(/^[a-f0-9]{24}$/i),
    mrf: z.string().regex(/^[a-f0-9]{24}$/i),
    gathersg: z.string().regex(/^[a-f0-9]{24}$/i),
    gathersgEmail: z.string().regex(/^[a-f0-9]{24}$/i),
  }),
})

const manifestSchema = z.object({
  staging: fixtureProfileSchema.optional(),
  uat: fixtureProfileSchema.optional(),
})

export function getEnvironmentConfig(env: NodeJS.ProcessEnv = process.env) {
  const environment = env.E2E_ENV || 'staging'
  if (!['staging', 'uat', 'production'].includes(environment)) {
    throw new Error(`Unsupported E2E_ENV: ${environment}`)
  }

  // Production retains the existing staging fixtures until production fixtures are supplied.
  const profileName = environment === 'uat' ? 'uat' : 'staging'
  if (!env.E2E_FIXTURE_MANIFEST) {
    throw new Error('E2E_FIXTURE_MANIFEST is required')
  }
  let manifest: unknown
  try {
    manifest = JSON.parse(env.E2E_FIXTURE_MANIFEST)
  } catch {
    throw new Error('E2E_FIXTURE_MANIFEST must contain valid JSON')
  }
  const parsed = manifestSchema.safeParse(manifest)
  if (!parsed.success) {
    throw new Error('E2E_FIXTURE_MANIFEST must contain valid pipe and form IDs')
  }
  const profile = parsed.data[profileName]
  if (!profile) {
    throw new Error(`E2E_FIXTURE_MANIFEST requires a ${profileName} profile`)
  }
  const baseUrl = env.BASE_URL || `https://${profileName}.plumber.gov.sg`
  if (
    environment === 'uat' &&
    new URL(baseUrl).hostname !== 'uat.plumber.gov.sg'
  ) {
    throw new Error('UAT tests must target uat.plumber.gov.sg')
  }

  return {
    ...profile,
    environment,
    baseUrl,
    authStateFile: `cookie-auth-state-${environment}`,
    webhookTesterHostname:
      env.WEBHOOK_TESTER_HOSTNAME ||
      'https://plumber-e2e-staging.plumber-wrench.workers.dev',
  }
}

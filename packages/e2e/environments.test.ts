import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { getEnvironmentConfig } from './environments'

const manifest = readFileSync(
  join(__dirname, 'fixture-manifest.example.json'),
  'utf8',
)
type FixtureManifest = Record<
  'staging' | 'uat',
  { pipes: Record<string, string>; forms: Record<string, string> }
>

const env = { E2E_FIXTURE_MANIFEST: manifest }

const observationUrl = 'https://uat-observation.example.com'

void test('defaults to staging and preserves local URL overrides', () => {
  const staging = getEnvironmentConfig(env)
  assert.equal(staging.baseUrl, 'https://staging.plumber.gov.sg')
  assert.equal(staging.pipes.editor, '00000000-0000-4000-8000-000000000110')
  assert.equal(
    getEnvironmentConfig({ ...env, BASE_URL: 'http://localhost:3001' }).baseUrl,
    'http://localhost:3001',
  )
})

void test('UAT selects a separate fixture for every staging pipe and form', () => {
  const staging = getEnvironmentConfig(env)
  const uat = getEnvironmentConfig({
    ...env,
    E2E_ENV: 'uat',
    WEBHOOK_TESTER_HOSTNAME: observationUrl,
  })
  assert.equal(uat.baseUrl, 'https://uat.plumber.gov.sg')
  assert.equal(uat.webhookTesterHostname, observationUrl)
  assert.notEqual(uat.authStateFile, staging.authStateFile)
  assert.equal(Object.keys(uat.pipes).length, 13)
  assert.equal(Object.keys(uat.forms).length, 4)
  for (const id of Object.values(uat.pipes)) {
    assert.ok(!Object.values(staging.pipes).includes(id))
    assert.match(id, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/)
  }
  for (const id of Object.values(uat.forms)) {
    assert.ok(!Object.values(staging.forms).includes(id))
    assert.match(id, /^[a-f0-9]{24}$/)
  }
})

void test('UAT rejects a staging URL override', () => {
  assert.throws(
    () =>
      getEnvironmentConfig({
        ...env,
        E2E_ENV: 'uat',
        BASE_URL: 'https://staging.plumber.gov.sg',
        WEBHOOK_TESTER_HOSTNAME: observationUrl,
      }),
    /UAT tests must target uat.plumber.gov.sg/,
  )
})

void test('UAT shares the existing observation service by default', () => {
  const staging = getEnvironmentConfig(env)
  const uat = getEnvironmentConfig({ ...env, E2E_ENV: 'uat' })
  assert.equal(uat.webhookTesterHostname, staging.webhookTesterHostname)
})

void test('preserves the existing production fixture selection', () => {
  const production = getEnvironmentConfig({ ...env, E2E_ENV: 'production' })
  const staging = getEnvironmentConfig(env)
  assert.equal(production.baseUrl, staging.baseUrl)
  assert.deepEqual(production.pipes, staging.pipes)
  assert.deepEqual(production.forms, staging.forms)
})

void test('rejects an unknown environment instead of falling back to staging', () => {
  assert.throws(
    () => getEnvironmentConfig({ ...env, E2E_ENV: 'typo' }),
    /Unsupported E2E_ENV/,
  )
})

void test('requires a private manifest without a hardcoded fallback', () => {
  assert.throws(
    () => getEnvironmentConfig({}),
    /E2E_FIXTURE_MANIFEST is required/,
  )
})

void test('rejects malformed JSON without exposing its contents', () => {
  assert.throws(
    () =>
      getEnvironmentConfig({ E2E_FIXTURE_MANIFEST: 'private-invalid-value' }),
    { message: 'E2E_FIXTURE_MANIFEST must contain valid JSON' },
  )
})

void test('rejects missing or invalid fixture IDs without exposing values', () => {
  const fixtures = JSON.parse(manifest) as FixtureManifest
  delete fixtures.staging.pipes.editor
  assert.throws(
    () =>
      getEnvironmentConfig({ E2E_FIXTURE_MANIFEST: JSON.stringify(fixtures) }),
    { message: 'E2E_FIXTURE_MANIFEST must contain valid pipe and form IDs' },
  )
  fixtures.staging.pipes.editor = 'private-invalid-value'
  assert.throws(
    () =>
      getEnvironmentConfig({ E2E_FIXTURE_MANIFEST: JSON.stringify(fixtures) }),
    { message: 'E2E_FIXTURE_MANIFEST must contain valid pipe and form IDs' },
  )
})

void test('requires the selected profile without falling back to another environment', () => {
  const fixtures = JSON.parse(manifest) as FixtureManifest
  const stagingOnly = JSON.stringify({ staging: fixtures.staging })
  assert.equal(
    getEnvironmentConfig({ E2E_FIXTURE_MANIFEST: stagingOnly }).environment,
    'staging',
  )
  assert.throws(
    () =>
      getEnvironmentConfig({
        E2E_ENV: 'uat',
        E2E_FIXTURE_MANIFEST: stagingOnly,
      }),
    { message: 'E2E_FIXTURE_MANIFEST requires a uat profile' },
  )
})

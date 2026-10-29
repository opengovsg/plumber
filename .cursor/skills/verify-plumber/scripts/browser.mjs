import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const { chromium } = createRequire(import.meta.url)('playwright-core')

const statePath = process.env.PLUMBER_VERIFY_STATE
if (!statePath) {
  throw new Error('PLUMBER_VERIFY_STATE is unset')
}

const state = JSON.parse(readFileSync(statePath, 'utf8'))
const browser = await chromium.connectOverCDP(
  `http://127.0.0.1:${state.cdpPort}`,
)
const context = browser.contexts()[0] ?? (await browser.newContext())
await context.addInitScript(() => {
  localStorage.setItem('announcement-modal-last-opened', '2026-08-31')
})

let page = context.pages()[0]
if (!page) {
  page = await context.newPage()
}
await page.setViewportSize({ width: 1280, height: 900 })

function argsAfter(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) {
    throw new Error(`Missing value for ${flag}`)
  }
  return process.argv[index + 1]
}

function has(flag) {
  return process.argv.includes(flag)
}

function artifactPath(filePath) {
  const root = state.artifacts
  mkdirSync(root, { recursive: true })
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath)
}

const command = process.argv[2]
if (!command) {
  throw new Error('Missing browser command')
}

try {

if (command === 'goto') {
  const target = process.argv[3]
  if (!target) {
    throw new Error('Missing path')
  }
  const url = target.startsWith('http') ? target : `${state.frontendUrl}${target}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
} else if (command === 'click') {
  if (has('--role')) {
    await page
      .getByRole(argsAfter('--role'), { name: argsAfter('--name'), exact: true })
      .click()
  } else if (has('--text')) {
    await page.getByText(argsAfter('--text'), { exact: true }).click()
  } else {
    throw new Error('click needs --role and --name, or --text')
  }
} else if (command === 'fill') {
  const value = argsAfter('--value')
  if (has('--role')) {
    await page
      .getByRole(argsAfter('--role'), { name: argsAfter('--name'), exact: true })
      .fill(value)
  } else if (has('--placeholder')) {
    await page.getByPlaceholder(argsAfter('--placeholder'), { exact: true }).fill(value)
  } else {
    throw new Error('fill needs --role and --name, or --placeholder')
  }
} else if (command === 'press') {
  await page.keyboard.press(argsAfter('--key'))
} else if (command === 'wait') {
  await page
    .getByText(argsAfter('--text'), { exact: true })
    .first()
    .waitFor({ state: 'visible', timeout: 20000 })
} else if (command === 'url') {
  process.stdout.write(`${page.url()}\n`)
} else if (command === 'reload') {
  await page.reload({ waitUntil: 'domcontentloaded' })
} else if (command === 'snapshot') {
  const destination = artifactPath(argsAfter('--path'))
  mkdirSync(path.dirname(destination), { recursive: true })
  const body = await page.locator('body').ariaSnapshot()
  writeFileSync(destination, body)
  process.stdout.write(`${destination}\n`)
} else if (command === 'screenshot') {
  const destination = artifactPath(argsAfter('--path'))
  mkdirSync(path.dirname(destination), { recursive: true })
  await page.screenshot({ path: destination, fullPage: true })
  process.stdout.write(`${destination}\n`)
} else {
  throw new Error(`Unknown browser command ${command}`)
}
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

process.exit(0)

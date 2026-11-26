import { emitKeypressEvents } from 'node:readline'
import { createInterface } from 'node:readline/promises'

import {
  ANSI,
  DEFAULTS,
  DETAIL_LEVELS,
  ENVIRONMENTS,
  FORMATS,
  PROJECTS,
  RANGES,
} from '../constants.mjs'
import { addDays, formatDate, parseDate } from '../utils/dates.mjs'

const CTRL_C_EXIT_CODE = 130

/**
 * Arrow-key menu. Enter picks the highlighted option, which starts on the default.
 */
function ask(question, options, defaultKey) {
  const { stdin, stdout } = process
  let index = Math.max(
    0,
    options.findIndex((option) => option.key === defaultKey),
  )

  const render = () => {
    for (const [i, option] of options.entries()) {
      const marker =
        option.key === defaultKey ? ` ${ANSI.dim}(default)${ANSI.reset}` : ''
      const line =
        i === index
          ? `${ANSI.cyan}❯ ${option.label}${ANSI.reset}${marker}`
          : `  ${option.label}${marker}`
      stdout.write(`${ANSI.clearLine}${line}\n`)
    }
  }

  stdout.write(
    `\n${question} ${ANSI.dim}(↑/↓, Enter)${ANSI.reset}\n${ANSI.hideCursor}`,
  )
  render()

  emitKeypressEvents(stdin)
  stdin.setRawMode(true)
  stdin.resume()

  return new Promise((resolve) => {
    const cleanup = () => {
      stdin.off('keypress', onKeypress)
      stdin.setRawMode(false)
      stdin.pause()
      stdout.write(ANSI.showCursor)
    }

    function onKeypress(text, key = {}) {
      if (key.ctrl && key.name === 'c') {
        cleanup()
        process.exit(CTRL_C_EXIT_CODE)
      }
      if (key.name === 'return' || key.name === 'enter') {
        cleanup()
        // Collapses the menu into one line that shows the answer.
        stdout.write(
          `${ANSI.cursorUp(options.length + 1)}${ANSI.clearToScreenEnd}${question} ${ANSI.cyan}${options[index].label}${ANSI.reset}\n`,
        )
        resolve(options[index].key)
        return
      }
      if (key.name === 'up' || key.name === 'k') {
        index = (index - 1 + options.length) % options.length
      } else if (key.name === 'down' || key.name === 'j') {
        index = (index + 1) % options.length
      } else if (/^[1-9]$/.test(text ?? '') && Number(text) <= options.length) {
        index = Number(text) - 1
      } else {
        return
      }
      stdout.write(ANSI.cursorUp(options.length))
      render()
    }

    stdin.on('keypress', onKeypress)
  })
}

async function askDate(label, defaultValue) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    for (;;) {
      const answer = (
        await rl.question(`${label} (YYYY-MM-DD, default ${defaultValue}): `)
      ).trim()
      const value = answer || defaultValue
      try {
        parseDate(label, value)
        return value
      } catch (error) {
        console.log(error.message)
      }
    }
  } finally {
    rl.close()
  }
}

const toOptions = (values) =>
  values.map((value) => ({ key: value, label: value }))

export async function promptForMissing(flags) {
  const answers = { ...flags }

  answers.project ??= await ask(
    'Project:',
    toOptions(PROJECTS),
    DEFAULTS.project,
  )
  answers.environment ??= await ask(
    'Environment:',
    toOptions(ENVIRONMENTS),
    DEFAULTS.environment,
  )

  const rangeKey = await ask(
    'Date range:',
    [...RANGES, { key: 'custom', label: 'Custom date range' }],
    DEFAULTS.range,
  )
  if (rangeKey === 'custom') {
    answers.from = await askDate(
      'Start date',
      formatDate(addDays(new Date(), -DEFAULTS.customRangeDays)),
    )
    answers.to = await askDate('End date', formatDate(new Date()))
  } else {
    answers.range = rangeKey
  }

  answers.include ??= await ask('Fields:', DETAIL_LEVELS, DEFAULTS.include)
  answers.format ??= await ask('Format:', toOptions(FORMATS), DEFAULTS.format)
  return answers
}
